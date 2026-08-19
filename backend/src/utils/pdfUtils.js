import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getLogoBase64() {
  const possiblePaths = [
    path.join(__dirname, "../assets/logorot.jpg"),
    path.join(__dirname, "../assets/logorot.png"),
    path.join(__dirname, "../../assets/logorot.jpg"),
    path.join(process.cwd(), "src/assets/logorot.jpg"),
    path.join(process.cwd(), "assets/logorot.jpg"),
    path.join(__dirname, "../../../frontend/src/assets/logorot.jpg"),
    path.join(__dirname, "../assets/logoschwarz.png"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const ext = path.extname(p).toLowerCase() === ".png" ? "png" : "jpeg";
        const fileBuffer = fs.readFileSync(p);
        return `data:image/${ext};base64,${fileBuffer.toString("base64")}`;
      } catch (err) {
        console.error(`[PDF] Fehler beim Lesen von ${p}:`, err);
      }
    }
  }
  return null;
}