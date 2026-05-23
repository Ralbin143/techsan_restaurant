import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { v4 as uuidv4 } from "uuid";

class StorageService {
  constructor() {
    if (env.storage.driver === "s3") {
      this.s3 = new S3Client({
        region: env.storage.aws.region,
        credentials: {
          accessKeyId: env.storage.aws.accessKeyId,
          secretAccessKey: env.storage.aws.secretAccessKey,
        },
      });
    }
  }

  async upload(file, folder = "uploads") {
    const ext = path.extname(file.originalname);
    const key = `${folder}/${uuidv4()}${ext}`;

    if (env.storage.driver === "s3") {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.storage.aws.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      return `https://${env.storage.aws.bucket}.s3.${env.storage.aws.region}.amazonaws.com/${key}`;
    }

    const dir = path.resolve(env.storage.uploadDir, folder);
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, path.basename(key));
    await fs.writeFile(filepath, file.buffer);
    return `/uploads/${folder}/${path.basename(key)}`;
  }
}

export const storageService = new StorageService();
