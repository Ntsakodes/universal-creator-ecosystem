import { ArgumentsHost, Catch, ExceptionFilter, Injectable, OnModuleDestroy, OnModuleInit, HttpException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { DomainError, requireProjectAccess } from '../../../packages/domain/policy.mjs';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
export const uuid = z.string().uuid();
export const text = (max = 200) => z.string().trim().min(1).max(max);
export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => schema.parse(value);
export const id = (value: string) => parse(uuid, value);
export type ActorRequest = Request & { actor: { id: string; email: string } };

export async function projectAccess(db: Database | Prisma.TransactionClient, projectId: string, userId: string, action = 'read') {
  const project = await db.project.findUnique({ where: { id: id(projectId) }, include: { members: { where: { userId } } } });
  if (!project) throw new DomainError('Project not found.', 404);
  requireProjectAccess(project, userId, project.members[0], action);
  return project;
}
export async function workAccess(db: Database | Prisma.TransactionClient, workId: string, userId: string, action = 'read') {
  const work = await db.work.findUnique({ where: { id: id(workId) } });
  if (!work) throw new DomainError('Work not found.', 404);
  await projectAccess(db, work.projectId, userId, action);
  return work;
}
export function audit(db: Database | Prisma.TransactionClient, actorId: string, action: string, resourceId: string, detail: Prisma.InputJsonObject = {}) {
  return db.auditEvent.create({ data: { actorId, action, resourceId, detail } });
}
export async function serial<T>(db: Database, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try { return await db.$transaction(operation, { isolationLevel: 'Serializable' }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && n < 3) continue; throw error; }
  }
}

@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) return res.status(400).json({ message: 'Check the submitted fields.', issues: error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
    if (error instanceof DomainError) return res.status(error.status).json({ message: error.message });
    if (error instanceof HttpException) return res.status(error.getStatus()).json({ message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ message: 'This record already exists. Refresh before retrying.' });
      if (error.code === 'P2025') return res.status(404).json({ message: 'Record not found.' });
    }
    console.error(JSON.stringify({ event: 'request_failed', type: error instanceof Error ? error.name : 'UnknownError' }));
    return res.status(500).json({ message: 'The request could not be completed.' });
  }
}
