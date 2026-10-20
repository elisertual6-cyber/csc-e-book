import { createServer, type Socket } from "node:net";
// Local-only test sink. No external recipient or service receives these messages.
export async function localSmtp() {
  const messages: string[] = [],
    sockets = new Set<Socket>();
  let accept = true;
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let buffer = "",
      data = false,
      body: string[] = [];
    socket.write("220 localhost ESMTP test receiver\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let newline;
      while ((newline = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (data) {
          if (line === ".") {
            data = false;
            if (accept) {
              messages.push(body.join("\r\n"));
              socket.write("250 accepted\r\n");
            } else socket.write("550 rejected for test\r\n");
            body = [];
          } else body.push(line);
          continue;
        }
        if (/^EHLO/i.test(line))
          socket.write("250-localhost\r\n250 PIPELINING\r\n");
        else if (/^DATA/i.test(line)) {
          data = true;
          socket.write("354 end with dot\r\n");
        } else if (/^QUIT/i.test(line)) {
          socket.end("221 bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No local SMTP port.");
  return {
    port: address.port,
    messages,
    setAccept(value: boolean) {
      accept = value;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
