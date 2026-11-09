import { createConnection } from 'node:net';

/** @returns {Promise<void>} */
export function scanWithClamav(bytes, host = '127.0.0.1', port = 3310) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let response = Buffer.alloc(0), settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve();
    };
    socket.setTimeout(30000, () => finish(new Error('Scanner unavailable or timed out.')));
    socket.on('error', finish);
    socket.on('data', chunk => {
      response = Buffer.concat([response, chunk]);
      if (response.length > 4096) return finish(new Error('Invalid scanner response.'));
      if (response.includes(0) || response.includes(10)) {
        finish(/^stream: OK[\u0000\r\n]*$/.test(response.toString()) ? undefined : new Error('File rejected by scanner.'));
      }
    });
    socket.on('end', () => finish(new Error('Scanner closed without a clean result.')));
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let i = 0; i < bytes.length; i += 65536) {
        const part = bytes.subarray(i, i + 65536);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(part.length);
        socket.write(size);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
