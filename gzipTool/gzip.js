const BUILD_PATH = "../static/build";
const GZIP_PATH = "../static/gzipBuild";

const fs = require("fs/promises");
const path = require("sandboxed-path");
path.changeSandboxScope.backOne();

const { gzip } = require("node-gzip");
const fileTools = {};
{
    fileTools.clearDir = async relativePath => {
        const folder = path.accessLocal(relativePath);
	
        let folderInfo;
        try {
            folderInfo = await fs.stat(folder);
        }
        catch (error) {
            await fs.mkdir(folder);
            folderInfo = await fs.stat(folder);
        }


        if (! folderInfo.isDirectory()) {
            throw new Error(`The build folder with the relative path \"${relativePath}\" has been taken by a file.`);
        }
        let toDelete = await fs.readdir(folder);

        for (let fileName of toDelete) {
            let filePath = path.sandboxPath(path.join(folder, fileName));

            await fs.rm(filePath, {
                recursive: true
            });
        }
    };
    fileTools.recursiveList = async (folder, allowOutside=false) => {
        let found = [];
        await recursiveListSub(folder, found, allowOutside, "");
        return found;
    };
    const recursiveListSub = async (folder, found, allowOutside, previousPath) => {
        let files = await fs.readdir(allowOutside? path.accessOutsideLocal(folder) : path.accessLocal(folder));
    
        for (let fileName of files) {
            let relativePath = path.join(folder, fileName);
            let filePath = allowOutside? path.accessOutsideLocal(relativePath) : path.accessLocal(relativePath);
            let newPath = path.join(previousPath, fileName);
    
            if ((await fs.stat(filePath)).isDirectory()) {
                found.push({
                    path: newPath,
                    isFolder: true
                });
    
                await recursiveListSub(relativePath, found, allowOutside, newPath + "/");
            }
            else {
                found.push({
                    path: newPath,
                    isFolder: false
                });
            }
        }
    };
}

const main = async _ => {
    console.log("Deleting previous gzipped build...");
    await fileTools.clearDir(GZIP_PATH);

    console.log("Gzipping build...");

    let buildFiles = await fileTools.recursiveList(BUILD_PATH, true);
    const gzipPath = path.accessLocal(GZIP_PATH);
    const buildPath = path.accessLocal(BUILD_PATH);

    for (let fileInfo of buildFiles) {
        let newfilePath = path.sandboxPath(path.join(gzipPath, fileInfo.path));
        let fileName = path.basename(newfilePath);
        if (fileName[0] == ".") continue;
        

        if (fileInfo.isFolder) {
            await fs.mkdir(newfilePath);
        }
        else {
            let compressed = await gzip(await fs.readFile(path.join(buildPath, fileInfo.path)));
            await fs.writeFile(newfilePath + ".gz", compressed);
        }
    }

    console.log(`Compressed ${buildFiles.length} build files and folders.`);
};
main();