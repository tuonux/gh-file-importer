/**
 * gh-file-importer.
 * author: tuonux <tuonux0@gmailcom>
 * repository: https://github.com/tuonux/gh-file-importer
 */

import { execSync } from "child_process";
import * as fs from "fs";

class GhFileImporter {
  constructor() {
    this.start();
  }
  async start() {
    this.showBanner();
    this.firstTimeSetup();
    await this.setupEnvironment();
    await this.getDbPath();
    await this.getSrcFiles();
    await this.connectToDb();
    await this.serialize();
  }
  exit(msg) {
    console.log(msg);
    process.exit();
  }
  showBanner() {
    console.clear();
    console.log("===========================================================================================");
    console.log(`\nGH - Importer tool\n\nmade with <3 by tuonux\n`);
  }
  firstTimeSetup() {
    if (!fs.existsSync("./node_modules")) {
      console.log("===========================================================================================");
      console.log("First running...");
      console.log("Wait until install Node.JS modules...");
      console.log("===========================================================================================");
      execSync("npm install");
    }
  }
  async setupEnvironment() {
    console.log("===========================================================================================");
    console.log("Load md5 module..");
    this.md5 = (await import("md5")).default;
    console.log("Load regedit module..");
    this.regedit = (await import("regedit")).default.promisified;
    console.log("Load sqlite3 module..");
    this.sqlite = (await import("sqlite3")).default.verbose();
    return true;
  }
  async getSrcFiles() {
    console.log("===========================================================================================");
    this.srcFolder = fs.readdirSync("./src");
    this.srcFiles = [];
    for (let f of this.srcFolder) {
      if (f == "." || f == ".." || f == ".gitkeep") continue;
      this.srcFiles.push({
        ID: this.md5(Date.now() + Math.floor(Math.random() * 999999999)),
        name: f,
        content: fs.readFileSync("./src/" + f).toString(),
        binary: 0,
      });
    }
    console.log("Content of ./src loaded");
    console.log(`${this.srcFiles.length} file founds.`);
    if (this.srcFiles.length == 0) return this.exit("No file to import. Aborted");
  }
  async getDbPath() {
    console.log("===========================================================================================");
    console.log("Get Grey Hack DB path");
    const steamRegistryKey = await this.regedit.list(["HKCU\\SOFTWARE\\Valve\\Steam"]);
    this.dbPath = steamRegistryKey["HKCU\\SOFTWARE\\Valve\\Steam"].values.SteamPath.value + "\\steamapps\\common\\Grey Hack\\Grey Hack_Data\\GreyHackDB.db";
  }
  async connectToDb() {
    console.log("===========================================================================================");
    console.log("Read Grey Hack database buffer");
    this.dbBuffer = fs.readFileSync(this.dbPath);
    console.log(this.dbBuffer);
    console.log("===========================================================================================");
    console.log("Open connection with Grey Hack database");
    this.db = new this.sqlite.Database(this.dbPath);
  }
  async serialize() {
    this.db.serialize(async () => {
      await this.insertFilesInFilesTable();
      await this.getComputerDataJson();
      await this.getHomeFolderObject();
      await this.getPlayerUsername();
      await this.insertSrcFilesIntoDb();
      await this.updateGameData();
    });
  }
  async insertFilesInFilesTable() {
    console.log("===========================================================================================");
    console.log("Insert new files content in file table");
    for (let f of this.srcFiles) {
      await this.executeQuery(`INSERT INTO Files (ID, Content, refCount) VALUES(?, ?, ?)`, [f.ID, f.content, 1]);
    }
  }
  async getComputerDataJson() {
    console.log("===========================================================================================");
    console.log("Get player computer data");
    return new Promise((resolve) => {
      this.db.each("SELECT FileSystem FROM Computer WHERE IsPlayer = 1", (err, row) => {
        this.computerJson = JSON.parse(row.FileSystem);
        this.currentObj = this.computerJson;
        resolve(this.computerJson);
      });
    });
  }
  async getHomeFolderObject() {
    console.log("===========================================================================================");
    console.log("Read /home on the player computer");
    for (let f of this.currentObj.folders) {
      if (f.nombre == "home") {
        this.currentObj = f;
        break;
      }
    }
  }
  async getPlayerUsername() {
    console.log("===========================================================================================");
    console.log("Get the user of the player computer");
    this.username = "";
    for (let f of this.currentObj.folders) {
      if (f.nombre == "guest") continue;
      this.username = f.nombre;
      this.currentObj = f;
      break;
    }
    if (this.username == "") return this.exit("No username folder founds. Aborted.");
    this.printPlayerInfo();
  }
  async printPlayerInfo() {
    console.log("===========================================================================================");
    console.log("Player name: ".padEnd(20, " ") + this.username);
    console.log("Home directory: ".padEnd(20, " ") + "/home/" + this.username);
  }
  async getNewFileObject(f) {
    return {
      ID: f.ID,
      allowImport: false,
      comando: "",
      desc: null,
      group: this.username,
      helperImport: null,
      isBinario: false,
      isDefaultContent: false,
      isEditedOtherPlayer: false,
      isProtected: false,
      missionID: "",
      nombre: f.name,
      origOwnerID: "",
      owner: this.username,
      permisos: {
        permisos: "-rwxrwx---",
      },
      precio: 0,
      process: "",
      saved: true,
      serverPath: "",
      size: f.content.length,
      typeFile: f.binary ? 1 : 0,
    };
  }
  async removePreviouslyFileObject(o) {
    console.log("Remove previously file object with name " + o.nombre + "");
    const oldFile = this.currentObj.files.find((e) => e.nombre == o.nombre);
    if (typeof oldFile != "undefined") {
      await this.executeQuery("DELETE FROM Files WHERE ID = ?", [oldFile.ID]);
    }
    this.currentObj.files = this.currentObj.files.filter((e) => e.nombre != o.nombre);
  }
  async insertSrcFilesIntoDb() {
    console.log("===========================================================================================");
    console.log("Insert ./src files data in comptuter data");
    for (let f of this.srcFiles) {
      const o = await this.getNewFileObject(f);
      await this.removePreviouslyFileObject(o);
      console.log("Push local ./src/" + f.name + " file in /home/" + this.username + " folder object");
      this.currentObj.files.push(o);
    }
  }
  async updateGameData() {
    console.log("===========================================================================================");
    console.log("New player computer data with updated /home/" + this.username + " object ready to be imported");
    console.log("===========================================================================================");
    console.log("Update game computer data with the updated status");
    await this.executeQuery("UPDATE Computer SET FileSystem = ? WHERE IsPlayer = 1", [JSON.stringify(this.computerJson)]);
    await this.printPlayerInfo();
    console.log("Imported files: ".padEnd(20) + this.srcFiles.length);
    console.log("===========================================================================================");
    console.log("\nPLAYER COMPUTER DATA UPDATED SUCCESSFULLY :)\n");
    console.log("===========================================================================================");
  }
  executeQuery(query, params = []) {
    return new Promise((resolve) => {
      this.db.run(query, params, function () {
        resolve(this);
      });
    });
  }
}

new GhFileImporter();
