import dgram from "node:dgram";
import { createHash } from "node:crypto";

const SSDP = `M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ssdp:all\r\n\r\n`;

function probeId() {
  return `urn:uuid:${createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 32)}`;
}

const WS_PROBE = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>${probeId()}</w:MessageID><w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`;

function header(text, name) {
  const match = text.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match ? match[1].trim().slice(0, 120) : "";
}

function listen(port, address, packet, ms) {
  return new Promise((resolve) => {
    const found = [];
    let socket;
    try {
      socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch {
      resolve(found);
      return;
    }
    const finish = () => {
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      resolve(found);
    };
    const timer = setTimeout(finish, ms);
    socket.on("error", () => {
      clearTimeout(timer);
      finish();
    });
    socket.on("message", (msg, rinfo) => {
      const text = msg.toString("utf8").slice(0, 1500);
      if (found.length >= 12) return;
      if (text.startsWith("M-SEARCH") || text.includes("<d:Probe>")) return;
      found.push({ text, address: rinfo.address });
    });
    socket.bind(port, () => {
      try {
        socket.addMembership(address);
        socket.send(packet, port, address);
      } catch {
        clearTimeout(timer);
        finish();
      }
    });
  });
}

export async function scanAnnouncements() {
  const hits = [];
  const ssdp = await listen(1900, "239.255.255.250", Buffer.from(SSDP), 1200);
  for (const item of ssdp) {
    const server = header(item.text, "SERVER") || header(item.text, "ST") || "UPnP";
    const camera = /onvif|networkvideo|ipcamera|camera/i.test(item.text);
    hits.push({
      id: `ssdp-${createHash("sha256").update(item.address + server).digest("hex").slice(0, 10)}`,
      tier: 2,
      name: camera ? "公布了影像服务的设备" : "UPnP 公布的设备",
      vendor: server.slice(0, 40),
      purpose: camera ? "设备自己回答了 ONVIF/UPnP 发现。没有打开画面，也没有尝试口令。" : "设备自己回答了局域网发现。没有连接它的管理页。",
      uptimeSec: 0,
      address: item.address,
      manifest: ["ssdp"],
      note: "只保留对方主动公布的服务名。",
      patchAuthority: "confirm",
    });
  }
  const onvif = await listen(3702, "239.255.255.250", Buffer.from(WS_PROBE), 900);
  for (const item of onvif) {
    if (!/ProbeMatch|NetworkVideo|onvif/i.test(item.text)) continue;
    hits.push({
      id: `onvif-${createHash("sha256").update(item.address).digest("hex").slice(0, 10)}`,
      tier: 2,
      name: "ONVIF 影像设备",
      vendor: "ONVIF",
      purpose: "回应了组播探测。没有拉流，没有尝试口令。",
      uptimeSec: 0,
      address: item.address,
      manifest: ["ws-discovery"],
      note: "只知道它在网上公布了影像服务。",
      patchAuthority: "confirm",
    });
  }
  return hits;
}
