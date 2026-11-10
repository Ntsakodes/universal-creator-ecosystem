import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../components/ui/Button';
import { ButtonLink } from '../components/ui/ButtonLink';
import { FormField } from '../components/ui/FormField';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../components/ui/States';
import { AppShell } from '../components/layout/AppShell';

test('shared buttons default to non-submitting and preserve explicit submit/disabled semantics', () => {
  assert.match(renderToStaticMarkup(<Button>Open</Button>), /type="button"/);
  const submit = renderToStaticMarkup(<Button type="submit" disabled>Save</Button>);
  assert.match(submit, /type="submit"/);
  assert.match(submit, /disabled=""/);
});

test('button links preserve native authentication and workspace destinations', () => {
  for (const href of ['/api/v1/auth/login', '/api/v1/auth/register', '/workspace']) {
    const html = renderToStaticMarkup(<ButtonLink href={href} variant="secondary">Continue</ButtonLink>);
    assert.match(html, /^<a /);
    assert.ok(html.includes(`href="${href}"`));
    assert.doesNotMatch(html, /<button|aria-disabled|onclick/i);
  }
});

test('fields retain labels, required/optional, initial values, select and numeric precision', () => {
  const input = renderToStaticMarkup(<FormField name="title" label="Project title" defaultValue="A story" />);
  assert.match(input, /<label[^>]*><span>Project title<\/span><input/);
  assert.match(input, /required=""/);
  assert.match(input, /value="A story"/);
  assert.doesNotMatch(renderToStaticMarkup(<FormField name="note" label="Note" required={false} type="textarea" />), /required=/);
  assert.match(renderToStaticMarkup(<FormField name="amount" label="Amount" type="number" />), /step="0.01"/);
  assert.match(renderToStaticMarkup(<FormField name="kind" label="Kind" defaultValue="film"><option value="film">Film</option></FormField>), /selected=""/);
});

test('cards provide named sections; states announce errors and progress; labels remain factual', () => {
  const card = renderToStaticMarkup(<Card title="Your projects">Content</Card>);
  const id = card.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(id);
  assert.ok(card.includes(`<h2 id="${id}">Your projects</h2>`));
  assert.match(renderToStaticMarkup(<ErrorState>Could not save</ErrorState>), /role="alert"/);
  assert.match(renderToStaticMarkup(<LoadingState />), /role="status"/);
  assert.match(renderToStaticMarkup(<StatusBadge tone="success">Rights claim documented</StatusBadge>), /Rights claim documented/);
});

test('shell retains all existing destinations, account actions and accessible menu relationships', () => {
  const items = ['Overview', 'Projects', 'IP Vault', 'Academic network', 'Community funding', 'AI assistant', 'My profile'];
  const html = renderToStaticMarkup(<AppShell items={items} active="Projects" onNavigate={() => {}} account={<button>Sign out</button>}>Workspace content</AppShell>);
  for (const item of items) assert.ok(html.includes(item));
  assert.match(html, /aria-current="page"[^>]*>[\s\S]*?Projects/);
  assert.match(html, /aria-expanded="false" aria-controls="workspace-navigation"/);
  assert.match(html, /id="workspace-navigation"/);
  assert.match(html, /href="#workspace-content"/);
  assert.match(html, /id="workspace-content"/);
  assert.match(html, /Sign out/);
});
