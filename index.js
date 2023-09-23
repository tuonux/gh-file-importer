const { exec } = require("child_process");
const fs = require("fs");
if (!fs.existsSync("./node_modules")) {
  exec("npm install");
}
const sqlite3 = require("sqlite3").verbose();
const prompt = require("prompt-sync")();
const md5 = require("md5");
const getPrompt = (str) => {
  console.log(str);
  return prompt("> ");
};
const defaultPath = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grey Hack";
let dbBuffer = null;
let dbPath = null;
console.clear();
console.log(`GH - Importer tool\nmade with <3 by tuonux`);
if (fs.existsSync("./config.ini")) {
  dbPath = fs.readFileSync("./config.ini").toString();
  console.log("Attempt to get DB buffer...");
  dbBuffer = fs.readFileSync(fs.readFileSync("./config.ini").toString());
}
while (!dbBuffer) {
  console.log("Get the path of GH installation directory under Steam -> Library -> Right click on Grey Hack -> Properties -> Installed Files -> Browse\n" + "Then copy and paste the path for the explorer address bar here\n");
  console.log("Default is: C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grey Hack");
  let gamePath = defaultPath;
  const iDirectory = getPrompt("Enter the game installation path (leave empty for default)");
  if (iDirectory != "") {
    gamePath = iDirectory;
  }
  dbPath = (gamePath + "\\Grey Hack_Data\\GreyHackDB.db").split(/\ /).join(" ");
  console.log("Check that the DB still present...");

  try {
    console.log("Attempt to get DB buffer...");
    dbBuffer = fs.readFileSync(dbPath);
  } catch {
    dbBuffer = null;
    dbPath = null;
    console.log("\n!!! Something goes wrong, repeat the steps !!!\n");
  }
}
console.log(dbBuffer);
console.log("Grey Hack DB Found!");
fs.writeFileSync("./config.ini", dbPath.toString());
console.log("Saved ./config.ini with Grey Hack DB path");
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
    console.log("DB Ready.");
    console.log("Attempt to read ./src folder...");
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
    console.log("Reading of ./src folder done.");
    console.log(`${srcFiles.length} file founds!`);
    for (f of srcFiles) {
      const queryStatus = await doQuery(`INSERT INTO Files (ID, Content, refCount) VALUES(?, ?, ?)`, [f.ID, f.content, 1]);
    }
    console.log("Files generated succesfully.");
    console.log("Attempt to update local player computer...");
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
      console.log("/home folder found.");
      console.log("Attempt to get the user of the player computer...");
      let username = "";
      for (f of currentObj.folders) {
        if (f.nombre == "guest") continue;
        username = f.nombre;
        currentObj = f;
        break;
      }
      if (username == "") throw "No username folder founds. Aborted.";
      console.log("User folder found.");
      console.log("Player name is: " + username);
      for (f of srcFiles) {
        console.log("Attempt to push ./src/" + f.name + " in /home/" + username + " folder object");
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
        console.log("Remove previously object with name " + o.nombre);
        currentObj.files = currentObj.files.filter((e) => e.nombre != o.nombre);
        console.log("Object updated succesfully");
        currentObj.files.push(o);
      }
      console.log("/home/" + username + " object updated successfully");
      console.log("Attempt to update computer player data with new status...");
      fs.writeFileSync("./updated.json", JSON.stringify(rowJson, null, 4));
      doQuery("UPDATE Computer SET FileSystem = ? WHERE IsPlayer = 1", [JSON.stringify(rowJson)]);
      console.log("\n\n\nPLAYER COMPUTER DATA UPDATED SUCCESSFULLY :)\n\n\n");
    });
  });
} catch (e) {
  console.log("!!! Something goes wrong. Aborted.!!!");
  console.log(e);
}
