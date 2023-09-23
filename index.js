/**
 * gh-file-importer.
 * author: tuonux <tuonux0@gmailcom>
 * repository: https://github.com/tuonux/gh-file-importer
 */
console.clear();
console.log("===========================================================================================");
console.log(`\nGH - Importer tool\n\nmade with <3 by tuonux\n`);
const execSync = require("child_process").execSync;
const fs = require("fs");
const getPrompt = (str) => {
  console.log(str);
  return prompt("> ");
};
let sqlite3 = null;
let prompt = null;
let md5 = null;
let dbBuffer = null;
let dbPath = null;
const firstTimeSetup = () => {
  if (!fs.existsSync("./node_modules")) {
    console.log("===========================================================================================");
    console.log("First time installation.");
    console.log("Attempt to install required Node.JS modules...");
    execSync("npm install");
    console.log("Done.");
  }
  sqlite3 = require("sqlite3").verbose();
  prompt = require("prompt-sync")();
  md5 = require("md5");
  const defaultPath = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grey Hack";
  console.log("===========================================================================================");
  console.log("\nGet Grey Hack installation path.\nYou can get the installation path under: Steam App -> Library -> Right click on Grey Hack -> Properties -> Installed Files -> Browse\n" + "Then copy the path from the explorer address bar and paste here\n");
  console.log("Default is: C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grey Hack\n");
  console.log("===========================================================================================");
  let gamePath = defaultPath;
  const iDirectory = getPrompt("Enter the game path (leave empty for default)");
  if (iDirectory != "") gamePath = iDirectory;
  dbPath = (gamePath + "\\Grey Hack_Data\\GreyHackDB.db").split(/\ /).join(" ");
  fs.writeFileSync("./config.ini", dbPath);
};
if (!fs.existsSync("./node_modules") || !fs.existsSync("./config.ini")) {
  firstTimeSetup();
} else {
  sqlite3 = require("sqlite3").verbose();
  prompt = require("prompt-sync")();
  md5 = require("md5");
}
dbPath = fs.readFileSync("./config.ini").toString();
console.log("===========================================================================================");
try {
  console.log("Attempt to get DB buffer...");
  if (!fs.existsSync(dbPath)) throw "Invalid db path provided.";
  dbBuffer = fs.readFileSync(dbPath);
  fs.writeFileSync("./config.ini", dbPath.toString());
  console.log("Saved ./config.ini with Grey Hack DB path for future imports");
} catch (e) {
  console.log("===========================================================================================");
  console.log("\n!!! Something goes wrong. Aborted !!!\n");
  console.log("===========================================================================================");
  console.log(e);
  console.log("===========================================================================================");
  fs.rmSync("./config.ini");
  process.exit();
}
console.log(dbBuffer);
console.log("Grey Hack DB Found!");
console.log("===========================================================================================");
console.log("Attempt to connect to DB...");
try {
  const db = new sqlite3.Database(dbPath);
  db.serialize(async () => {
    const doQuery = (query, params = []) => {
      return new Promise((resolve) => {
        db.run(query, params, function () {
          resolve(this);
        });
      });
    };
    console.log("Done.");
    console.log("Attempt to read local ./src folder...");
    const srcFolder = fs.readdirSync("./src");
    const srcFiles = [];
    for (f of srcFolder) {
      if (f == "." || f == ".." || f == ".gitkeep") continue;
      srcFiles.push({
        ID: md5(Date.now() + Math.floor(Math.random() * 999999999)),
        name: f,
        content: fs.readFileSync("./src/" + f).toString(),
        binary: 0,
      });
    }
    console.log("Done.");
    console.log(`${srcFiles.length} file founds.`);
    if (srcFiles.length == 0) {
      console.log("No file to import. Aborted.");
      process.exit();
    }
    for (f of srcFiles) {
      const queryStatus = await doQuery(`INSERT INTO Files (ID, Content, refCount) VALUES(?, ?, ?)`, [f.ID, f.content, 1]);
    }
    db.each("SELECT FileSystem FROM Computer WHERE IsPlayer = 1", (err, row) => {
      const rowJson = JSON.parse(row.FileSystem);
      let pathToReach = "/home";
      let currentObj = rowJson;
      console.log("Attempt to read /home on the player computer...");
      for (path of pathToReach.split("/")) {
        for (f of currentObj.folders) {
          if (f.nombre == path) {
            currentObj = f;
            break;
          }
        }
      }
      console.log("/home folder in game computer found.");
      console.log("Attempt to get the user of the player computer...");
      let username = "";
      for (f of currentObj.folders) {
        if (f.nombre == "guest") continue;
        username = f.nombre;
        currentObj = f;
        break;
      }
      if (username == "") throw "No username folder founds. Aborted.";
      console.log("===========================================================================================");
      console.log("Player name: ".padEnd(20, " ") + username);
      console.log("Home directory: ".padEnd(20, " ") + "/home/" + username);
      console.log("===========================================================================================");
      for (f of srcFiles) {
        const o = {
          ID: f.ID,
          allowImport: false,
          comando: "",
          desc: null,
          group: username,
          helperImport: null,
          isBinario: false,
          isDefaultContent: false,
          isEditedOtherPlayer: false,
          isProtected: false,
          missionID: "",
          nombre: f.name,
          origOwnerID: "",
          owner: username,
          permisos: {
            permisos: "-rwxrwx---",
          },
          precio: 0,
          process: "",
          saved: true,
          serverPath: "",
          size: 0,
          typeFile: f.binary ? 1 : 0,
        };
        console.log("Attempt to remove previously file object with name " + o.nombre + "...");
        currentObj.files = currentObj.files.filter((e) => e.nombre != o.nombre);
        console.log("Done.");
        console.log("Attempt to push local ./src/" + f.name + " file in /home/" + username + " folder object");
        currentObj.files.push(o);
        console.log("Done.");
      }
      console.log("/home/" + username + " ready to be imported.");
      console.log("Attempt to update game computer data with the updated status...");
      doQuery("UPDATE Computer SET FileSystem = ? WHERE IsPlayer = 1", [JSON.stringify(rowJson)]);
      console.log("===========================================================================================");
      console.log("\n\nPLAYER COMPUTER DATA UPDATED SUCCESSFULLY :)\n\n");
      console.log("===========================================================================================");
    });
  });
} catch (e) {
  console.log("===========================================================================================");
  console.log("!!! Something goes wrong. Aborted.!!!");
  console.log("===========================================================================================");
  console.log(e);
  console.log("===========================================================================================");
}
