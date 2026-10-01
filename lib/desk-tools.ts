import type { AgentProfile } from "./fleet";

export function redact(value: string): string {
  return value
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "x.x.x.x")
    .replace(/mac:[0-9a-f:]+/gi, "mac:hidden")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email@hidden");
}

export function fleetCsv(fleet: AgentProfile[]): string {
  const lines = ["name,tier,vendor,purpose,did"];
  for (const agent of fleet) {
    const cells = [agent.name, String(agent.tier ?? ""), agent.vendor || "", agent.purpose || agent.sandboxNote, agent.s2Did];
    lines.push(cells.map((cell) => `"${redact(cell).replace(/"/g, "''")}"`).join(","));
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function simplePdf(title: string, lines: string[]): string {
  const safe = [title, ...lines].map((line) => redact(line).replace(/[^\x20-\x7E]/g, " ")).slice(0, 28);
  const content = safe.map((line, index) => `BT /F1 12 Tf 48 ${760 - index * 22} Td (${line.replace(/[()\\]/g, " ")}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return body;
}
