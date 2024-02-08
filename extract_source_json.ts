import * as fs from "fs"
import * as path from "path"
import { retrieveICMLFiles, extractStringsFromICML, isValidIso, validIsoCodes } from "./shared_functions"

const argv = require('minimist')(process.argv.slice(2));
Object.freeze(argv);

let icmlFolder: string = argv['source-folder'] ?? argv['f'] ?? process.env.ICML_FOLDER_LOCATION ?? "../InCopy";
let sourceLang: string = argv['source-lang'] ?? argv['l'] ?? process.env.SOURCE_LANG ?? 'en';
let translationsFolder: string = argv['translations-folder'] ?? argv['t'] ?? process.env.TRANSLATIONS_FOLDER ?? "../i18n";

let languageNames = new Intl.DisplayNames(["en"], { type: "language" });

(() => {
    if( false === isValidIso( sourceLang ) ) {
        console.error(`'${sourceLang}' is not a valid two letter ISO code, must be one of: ${validIsoCodes.join(' ')}`);
    }
    console.log('Source lang set to ' + languageNames.of(sourceLang) );

    if (!fs.existsSync(icmlFolder)) {
        console.error("Source folder " + icmlFolder + " not found: exiting.");
        return;
    }

    let sourceFolder: string = path.join(icmlFolder, sourceLang);
    if (!fs.existsSync(sourceFolder) ) {
        console.error(`Source language folder "${sourceFolder}" not found: exiting.`);
        return;
    }

    console.log('Retrieving ICML files from source folder...');
    let icmlFiles: string[] | boolean = retrieveICMLFiles(sourceFolder);
    if( false === icmlFiles ) {
        console.error('Script terminated in error, ICML files not found');
    } else {
        icmlFiles = icmlFiles as string[];
        let sourceStrings = extractStringsFromICML(icmlFiles, sourceFolder);
        //console.log(sourceStrings);
        if( !fs.existsSync(translationsFolder) ) {
            fs.mkdirSync(translationsFolder);
        }
        let sourceTranslationFile: string = path.join(translationsFolder, sourceLang + '.json');
        fs.writeFileSync( sourceTranslationFile, JSON.stringify(sourceStrings, undefined, "\t"), "utf8" );
    }
})();


/*
function extractSourceJSON(sourceFolder: string) {

    if (!fs.existsSync(translationsFolder)) {
        fs.mkdirSync(translationsFolder);
        console.log("Created non existent translations folder " + translationsFolder + "...");
    }


    fs.writeFileSync(path.join(translateJSONPath, sourceLang, "translation.json"), JSON.stringify(translationObj, null, 4)); 
    console.log("Wrote file " + path.join(translateJSONPath, sourceLang, "translation.json"));
}
*/