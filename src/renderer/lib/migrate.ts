import { createLogger } from "../utils/log";
import { WINBOAT_DIR } from "./constants";

const path: typeof import("path") = require("path");
const fs: typeof import("fs") = require("fs");
const logger = createLogger(path.join(WINBOAT_DIR, "migrations.log"));

type Migration = {
    name: string;
    /** Whether the migration needs to run against the current installation */
    isNeeded: () => boolean | Promise<boolean>;
    migrate: () => Promise<void>;
};

/**
 * Migrations run in order on every app start, each gated by its own `isNeeded` check.
 */
const migrations: Migration[] = [
    {
        name: "disable-autostart-container",
        isNeeded: () => {
            const dockerFile = path.join(WINBOAT_DIR, "docker-compose.yml");
            const podmanFile = path.join(WINBOAT_DIR, "podman-compose.yml");
            const targetFile = fs.existsSync(dockerFile) ? dockerFile : fs.existsSync(podmanFile) ? podmanFile : null;
            if (!targetFile) return false;
            try {
                const content = fs.readFileSync(targetFile, "utf-8");
                return content.includes("restart: unless-stopped") || content.includes("restart: always");
            } catch {
                return false;
            }
        },
        migrate: async () => {
            const dockerFile = path.join(WINBOAT_DIR, "docker-compose.yml");
            const podmanFile = path.join(WINBOAT_DIR, "podman-compose.yml");
            const targetFile = fs.existsSync(dockerFile) ? dockerFile : fs.existsSync(podmanFile) ? podmanFile : null;
            if (!targetFile) return;
            const content = fs.readFileSync(targetFile, "utf-8");
            const updated = content.replace(/restart:\s*"?unless-stopped"?/g, 'restart: "no"').replace(/restart:\s*"?always"?/g, 'restart: "no"');
            fs.writeFileSync(targetFile, updated, "utf-8");
            logger.info(`[performAutoMigrations]: Migrated ${targetFile} to restart: "no"`);
        },
    },
];

/**
 * This function performs the necessary automatic migrations
 * when updating to newer versions of WinBoat
 */
export async function performAutoMigrations(): Promise<void> {
    logger.info("[performAutoMigrations]: Starting automatic migrations");

    for (const migration of migrations) {
        try {
            if (!(await migration.isNeeded())) continue;

            logger.info(`[performAutoMigrations]: Running migration '${migration.name}'`);
            await migration.migrate();
        } catch (e: any) {
            logger.error(`[performAutoMigrations]: Migration '${migration.name}' failed`);
            logger.error(e.message ?? e);
        }
    }

    logger.info("[performAutoMigrations]: Finished automatic migrations");
}
