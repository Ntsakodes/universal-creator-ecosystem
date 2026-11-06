import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { assertLocalTestEnvironment, isLocalIdentity, LOCAL_DATABASE, LOCAL_APP_URL } from '../packages/domain/local-test.mjs';
import { scanWithClamav } from '../packages/domain/clamav.mjs';

const safe={nodeEnv:'development',databaseUrl:LOCAL_DATABASE,appUrl:LOCAL_APP_URL};
test('local testing accepts only an isolated loopback database',()=>{
  assertLocalTestEnvironment(safe);
  for(const databaseUrl of [
    'postgresql://u:p@database.example/uce_local_test',
    'postgresql://u:p@127.0.0.1/uce',
    'postgresql://u:p@127.0.0.1/production',
    'https://127.0.0.1/uce_local_test'
  ])assert.throws(()=>assertLocalTestEnvironment({...safe,databaseUrl}),{status:503});
});
test('local entrypoint refuses production and public binding',()=>{
  assert.throws(()=>assertLocalTestEnvironment({...safe,nodeEnv:'production'}),{status:503});
  assert.throws(()=>assertLocalTestEnvironment({...safe,bindAddress:'0.0.0.0'}),{status:503});
});
test('local app cannot use a remote URL or embedded credentials',()=>{
  for(const appUrl of ['https://uce.example','http://0.0.0.0:3000','http://user:pass@localhost:3000','http://localhost:3000/other','http://localhost:3000/?redirect=evil']) {
    assert.throws(()=>assertLocalTestEnvironment({...safe,appUrl}),{status:503});
  }
});
test('test identity selector rejects regular identity-provider subjects',()=>{
  assert.equal(isLocalIdentity('local-test:creator'),true);
  assert.equal(isLocalIdentity('cognito-identity'),false);
  assert.equal(isLocalIdentity(undefined),false);
});

async function scannerFixture(reply,operation) {
  let received=Buffer.alloc(0);
  const server=createServer(socket=>{
    socket.on('data',chunk=>{
      received=Buffer.concat([received,chunk]);
      if(received.length>=10&&received.subarray(-4).equals(Buffer.alloc(4)))socket.end(reply);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    await operation(server.address().port);
    assert.equal(received.subarray(0,10).toString(),'zINSTREAM\0');
    assert.equal(received.readUInt32BE(10),5);
    assert.equal(received.subarray(14,19).toString(),'dummy');
  } finally { await new Promise(resolve=>server.close(resolve)); }
}
test('ClamAV protocol accepts only an explicit clean response',async()=>{
  await scannerFixture('stream: OK\0',port=>scanWithClamav(Buffer.from('dummy'),'127.0.0.1',port));
});
test('ClamAV findings never count as a clean upload',async()=>{
  await scannerFixture('stream: TestSignature FOUND\0',port=>assert.rejects(scanWithClamav(Buffer.from('dummy'),'127.0.0.1',port)));
});
test('a truncated scanner reply fails closed',async()=>{
  await scannerFixture('stream: ',port=>assert.rejects(scanWithClamav(Buffer.from('dummy'),'127.0.0.1',port)));
});
