import fs from "fs"
import path from "path"
import { TranslationEntry, getICMLFilePathForName, htmlEntryToTextEntries, isValidIso } from "./shared_functions"
//import { encode } from 'html-entities'


const icmlFolder: string       = "./input";
const outputFolder: string      = "./output";
const translateJSONPath: string = "./translate_json";

async function translateICMLFiles() {
    console.log('starting translation process...');
    try {

        // await rmfr(outputFolder);
        // fs.mkdirSync(outputFolder);
        // console.log("Removed output directory");

        let fileNames: string[] = fs.readdirSync(icmlFolder);
        const icmlDirectoryNames: string[] = fileNames.filter((fileName) => fs.statSync(path.join(icmlFolder, fileName)).isDirectory());
        for (let icmlName of icmlDirectoryNames) {
            //await ncpPromise(path.join(icmlFolder, icmlName), path.join(outputFolder, icmlName));
            console.log("Copied input to output folder for ", path.join(icmlFolder, icmlName));
            translateICML(icmlName);
        }

    } catch (ex) {
        console.error("Error removing or copying directory:", ex);
    }
}

translateICMLFiles().then(() => {
    console.log("Done");
})

function translateICML(icmlName: string) {
    let sourceLang: string = 'en';

    // Create output folder for this ICML file
    const outputSubPath = path.join(outputFolder, icmlName);
    if (!fs.existsSync(outputSubPath)) {
        fs.mkdirSync(outputSubPath);
        console.log("Created non existent output path " + outputSubPath);
    }

    let inputFilePath: string|null = getICMLFilePathForName(icmlFolder, icmlName);
    if (inputFilePath === null) {
        console.warn("Could not find ICML file for ", icmlName);
        return;
    } else {
        sourceLang = inputFilePath.split(/.*[\/|\\]/)[1].split('.')[0];
        console.log("Detected source lang: ", sourceLang);
    }

    let translateJSONSubPath: string = path.join(translateJSONPath, icmlName);
    let languageCodes: string[] = fs.readdirSync(translateJSONSubPath).filter((langCode) => langCode !== sourceLang && isValidIso(langCode) );

    for (let langCode of languageCodes) {

        /*const tempPathTranslated: string = path.join(tempPath, langCode);
        if (!fs.existsSync(tempPathTranslated)) {
            fs.mkdirSync(tempPathTranslated);
            console.log("Created non existent temp path " + tempPathTranslated);
        }
        */

        // Do actual translation
        //translateStoriesXML(tempPathTranslated, langCode, icmlName);

        // Combine files back into ZIP file for output InDesign Markup file
        //const outputZip: AdmZip = new AdmZip();
        /*fs.readdirSync(tempPathTranslated).forEach((file) => {
            try {
                var filePath = path.join(tempPathTranslated, file);
                if (fs.statSync(filePath).isDirectory()) {
                    //outputZip.addLocalFolder(filePath, file);
                } else {
                    //outputZip.addLocalFile(filePath);
                }
            } catch (ex) {
                console.warn("Error adding file to ICML", ex);
            }
        });
        */
        //const outputZipPath: string = path.join(outputSubPath, langCode + ".icml");
        console.log("Writing InDesign Markup File for", icmlName, "for language code", langCode);
        //outputZip.writeZip(outputZipPath);
        // rimraf(tempPath, (err) => {});
    }
}

function translateStoriesXML(folder: string, langCode: string, icmlName: string) {
    //const storiesPath: string           = path.join(folder, "Stories");
    const spreadsPath: string           = path.join(folder, "Spreads");
    //const spreadIdsInOrder: string[]    = getSpreadIdsInOrder(folder);
    const translateObjPath: string      = path.join(translateJSONPath, icmlName, langCode, 'translation.json');
    console.log('Parsing JSON from ',translateObjPath,'...');
    const translationObj: {[key: string]: {[key: string]: {[key: string]: string} } } = JSON.parse(fs.readFileSync(translateObjPath).toString());
    fs.readdirSync(spreadsPath).forEach((spreadFile) => {
        const spreadId = spreadFile.replace("Spread_", "").replace(".xml", "");
        const spreadFilePath = path.join(spreadsPath, spreadFile);
        console.log("Reading spread file",spreadFilePath,'...');
        const spreadFileContents = fs.readFileSync(spreadFilePath).toString();
        //const storyIds = getStoriesForSpread(spreadFileContents);
        //console.log('Extracted storyIds:',storyIds.join(','),'from spreadFile',spreadFilePath);
        let perStoryTranslateMap: { [storyId: string]: { [srcLang: string]: string } } = {};
        let nonStoryTranslateMap: { [srcLang: string]: string } = {};
        //storyIds.forEach((storyId) => perStoryTranslateMap[storyId] = {});
        let spreadTranslateEntries: TranslationEntry[];
        let pageId: string = '';
        let pageObj: {[key: string]: {[key: string]: string} };
        try {
            //pageId = pageFileNameForSpreadId(spreadIdsInOrder, spreadId);
            console.log('spreadId',spreadId,'translates to pageId',pageId);
            console.log('Retrieving translation strings for page',pageId,'...');
            if( translationObj.hasOwnProperty(pageId) ) {
                console.log( 'Found pageId',pageId,'in translationObj, now retrieving pageObj...');
                pageObj = translationObj[pageId];
                spreadTranslateEntries = Object.keys(pageObj).reduce((previousValue: TranslationEntry[], storyId: string) => {
                    Object.keys(pageObj[storyId]).forEach(srcText => {
                        let objx: TranslationEntry = {
                            sourceText: srcText,
                            text: pageObj[storyId][srcText],
                            storyId: storyId,
                            note: '',
                            type: srcText.startsWith('<a id=') && srcText.endsWith('</a>') ? 'html' : 'text'
                        };
                        previousValue.push(objx);
                    });
                    return previousValue;
                },[]);
                console.log('spreadTranslateEntries has ' + spreadTranslateEntries.length + ' entries');
                //console.log(spreadTranslateEntries);
                for (let entry of spreadTranslateEntries) {
                    if (entry.type === "html") {
                        console.log('  >>  dealing with html entry...');
                        let subEntries = htmlEntryToTextEntries(entry);
                        for (let subEntry of subEntries) {
                            if (subEntry.storyId) {
                                perStoryTranslateMap[subEntry.storyId][subEntry.sourceText] = subEntry.text;
                            }
                            nonStoryTranslateMap[subEntry.sourceText] = subEntry.text;
                        }
                    } else {
                        console.log('  >>  dealing with text entry...');
                        console.log(entry);
                        if (entry.storyId) {
                            console.log('adding mapping for storyId =',entry.storyId,', sourceText =',entry.sourceText,', text = ',entry.text,'...');
                            perStoryTranslateMap[entry.storyId][entry.sourceText] = entry.text;
                        }
                        nonStoryTranslateMap[entry.sourceText] = entry.text;
                    }
                }
            } else {
                console.log('Could not find pageId',pageId,'in translationObj');
            }
            //console.log(pageObj);
        } catch (ex) {
            console.debug(ex);
            if( pageId !== '' ) {
                console.log("In InDesign file", icmlName, ("Missing pageId " + pageId + " in translation file for language"), langCode);
            } else {
                console.log("In InDesign file", icmlName, "Missing translation file for spread id", spreadId, "for language", langCode);
            }
            process.exit();
            //return;
        }
        /*storyIds.forEach((storyId) => {
            let storyFile = `Story_${storyId}.xml`;
            console.log('Reading story file',path.join(storiesPath, storyFile));
            const storyFileContents = fs.readFileSync(path.join(storiesPath, storyFile)).toString();
            let modifiedXML = removeSomeForbiddenCharacters(storyFileContents);
            let storyTranslateMap = extractStoryMap(storyFileContents);
            console.log(storyTranslateMap);
            Object.keys(storyTranslateMap).forEach((key) => {
                if (perStoryTranslateMap[storyId][key]) {
                    //IMPORTANT! After updating the fast-xml-parser library, html entities were transformed into utf8 character equivalents
                    //Now, when searching the original text so as to perform a substitution,
                    //we have to make sure we are looking for a string with html entities, not with utf8 character equivalents!
                    modifiedXML = modifiedXML.replace(encode( storyTranslateMap[key], {mode: 'specialChars'}), encode( perStoryTranslateMap[storyId][key], {mode: 'specialChars'}) );
                    //console.log('search:',storyTranslateMap[key]);
                    //console.log('search encoded:', encode( storyTranslateMap[key], {mode: 'specialChars'}));
                    //console.log('replace:', perStoryTranslateMap[storyId][key]);
                    //console.log('replace encoded:', encode( perStoryTranslateMap[storyId][key], {mode: 'specialChars'}) );
                } else if (nonStoryTranslateMap[key]) {
                    console.warn("Translation used but no story id", key, nonStoryTranslateMap[key]);
                    modifiedXML.replace(key, nonStoryTranslateMap[key]);
                } else {
                    console.warn("In InDesign file", icmlName, "Missing translation for", key);
                }
            });
            //console.log( modifiedXML );
            //if( storyId === 'ufab' ) process.exit();
            console.log('Writing translated story file',path.join(storiesPath, storyFile));
            fs.writeFileSync(path.join(storiesPath, storyFile), modifiedXML, { flag: "w+" });
        });
        */
    });
}