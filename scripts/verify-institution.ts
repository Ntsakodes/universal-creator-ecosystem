import { PrismaClient } from '@prisma/client';
// Operator-only command after checking the institution and representative's mandate.
const [institutionId,operatorUserId,...referenceParts]=process.argv.slice(2);
const reference=referenceParts.join(' ');
if(!institutionId||!operatorUserId||reference.length<20)throw new Error('Usage: tsx --env-file=.env scripts/verify-institution.ts INSTITUTION_UUID OPERATOR_USER_UUID evidence-reference-at-least-20-characters');
const db=new PrismaClient();
async function main(){
  try{
    await db.$transaction(async tx=>{
      await tx.user.findUniqueOrThrow({where:{id:operatorUserId}});
      const i=await tx.institution.update({where:{id:institutionId},data:{verifiedAt:new Date(),verificationReference:reference}});
      await tx.auditEvent.create({data:{actorId:operatorUserId,action:'institution.verified_by_operator',resourceId:i.id,detail:{reference}}});
    });
    console.log('Institution verification recorded.');
  }finally{await db.$disconnect();}
}
void main();
