import axios from "axios";
import {createWriteStream, existsSync, mkdirSync} from "fs";
import {unlink} from "fs/promises";
import {fileURLToPath} from "url";
import path, {dirname, resolve} from "path";
import {path as ffmpegPath} from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

// eslint-disable-next-line no-shadow
const __dirname = dirname(fileURLToPath(import.meta.url));
class FileManager {
  private readonly projectFileFolder = resolve(__dirname, "../", "../assets");

  public aaa = null;

  constructor(fileFolderPath?: string) {
    if (fileFolderPath) {
      this.projectFileFolder = fileFolderPath;
    }
    if (!existsSync(this.projectFileFolder)) {
      mkdirSync(this.projectFileFolder);
    }
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  async saveAudioFile(url: string, fileName: string): Promise<string> {
    try {
      const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
      });
      const oggFilePath = resolve(this.projectFileFolder, `${fileName}.ogg`);
      const stream = createWriteStream(oggFilePath);
      response.data.pipe(stream);

      return new Promise((res) => {
        stream.on("finish", () => res(oggFilePath));
      });
    } catch {
      // eslint-disable-next-line no-console
      console.log("Ошибка при создании файла");

      return "";
    }
  }

  async removeFile(fileUrl: string) {
    try {
      await unlink(fileUrl);
    } catch {
      // eslint-disable-next-line no-console
      console.log("Ошибка при удалении файла");
    }
  }

  async convertOggToMp3(oggFileUrl: string): Promise<string> {
    try {
      const fileName = path.basename(oggFileUrl, ".ogg");
      const mp3FilePath = resolve(this.projectFileFolder, `${fileName}.mp3`);

      return new Promise((res, rej) => {
        ffmpeg()
          .input(oggFileUrl)
          .inputOption("-t 30")
          .output(mp3FilePath)
          .toFormat("mp3")
          .on("error", (error) => rej(error))
          .on("end", () => {
            this.removeFile(oggFileUrl);
            res(mp3FilePath);
          })
          .run();
      });
    } catch {
      // eslint-disable-next-line no-console
      console.log("Ошибка конвертации ogg to mp3");

      return "";
    }
  }
}

export const fileManager = new FileManager();