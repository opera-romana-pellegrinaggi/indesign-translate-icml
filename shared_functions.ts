import { XMLParser } from "fast-xml-parser"
import DomParser from "dom-parser"
import { encode, decode } from "html-entities"
import fs from "fs"
import path from "path"

export type PSRType = "text" | "hyperlink"

export interface PSRSummary {
    content: string;
    type: PSRType;
    self?: string;
    name?: string;
    csrIdx: number;
    contentIdx: number;
}

export interface TranslationEntry {
    sourceText: string;
    text: string;
    storyId: string;
    note?: string;
    type?: "text" | "html";
}


export function storyXMLNullCheck(storyXmlParsed: { Document: { Story: { ParagraphStyleRange: string | any[] }[] }[] }): boolean {
    if (storyXmlParsed
        && storyXmlParsed.Document[0]
        && storyXmlParsed.Document[0].Story[0]
        && storyXmlParsed.Document[0].Story[0].ParagraphStyleRange
        && storyXmlParsed.Document[0].Story[0].ParagraphStyleRange.length > 0
    ) {
        return true;
    }
    return false;
}


export function extractStoryMap(storyFileContents: string): {[key: string]: string} {
    const alwaysArray = [
        'Document',
        'Document.Story',
        'Document.Story.ParagraphStyleRange',
        'Document.Story.ParagraphStyleRange.CharacterStyleRange',
        'Document.Story.ParagraphStyleRange.CharacterStyleRange.HyperlinkTextSource'
    ];
    const parser = new XMLParser({
        isArray: (name, jpath, isLeafNode, isAttribute) => { 
            return (alwaysArray.indexOf(jpath) !== -1);
        }
    });
    const storyXmlParsed = parser.parse(storyFileContents);
    //if( storyXmlParsed.Document[0].Story[0] )
    let storyTranslateMap: {[key: string]: string} = {};
    let lastPsr = null;
    if (storyXMLNullCheck(storyXmlParsed)) {
        try {
            storyXmlParsed.Document[0].Story[0].ParagraphStyleRange.forEach((psr) => {
                lastPsr = psr;
                if (psr.CharacterStyleRange && psr.CharacterStyleRange.length > 0) {
                    //console.log( psr.CharacterStyleRange );
                    psr.CharacterStyleRange.forEach((csr) => {
                        if (csr.HyperlinkTextSource
                            && csr.HyperlinkTextSource[0]
                            && csr.HyperlinkTextSource[0].Content
                            && typeof csr.HyperlinkTextSource[0].Content === "string"
                        ) {
                            let str: string = csr.HyperlinkTextSource[0].Content;
                            let cont: string = csr.HyperlinkTextSource[0].Content;
                            storyTranslateMap[str] = cont;
                        }
                        if (csr.Content) {
                            if (typeof csr.Content === "string" || typeof csr.Content === "number") {
                                let str = csr.Content + "";
                                let cont = csr.Content + "";
                                storyTranslateMap[str] = cont;
                            } else if (Array.isArray(csr.Content)) {
                                csr.Content.forEach((str: string) => {
                                    storyTranslateMap[str] = str;
                                });
                            }
                        }
                    });
                }
            });
        } catch (ex) {
            console.warn("Error parsing story at paragraph style range");
            console.warn(JSON.stringify(lastPsr, null, 4));
            console.debug(ex);
        }
        
    }
    return storyTranslateMap;
}

export function textToPSRSummary(text: string, csrIdx: number, contentIdx: number): PSRSummary {
    return {
        content: text,
        type: "text",
        csrIdx: csrIdx,
        contentIdx: contentIdx
    };
}

export function extractStoryPSRList(storyFileContents: string): {[key: string]: PSRSummary[] } {
    const arrayElements = [
        'Document',
        'Document.Story',
        'Document.Story.ParagraphStyleRange',
        'Document.Story.ParagraphStyleRange.CharacterStyleRange'
    ];
    const parser: XMLParser = new XMLParser({
        ignoreAttributes: false,
        isArray: (name, jpath, isLeafNode, isAttribute) => arrayElements.includes(jpath)
    });
    const storyXmlParsed = parser.parse(storyFileContents);
    //console.log(storyXmlParsed);
    //console.log(`Document.length=${storyXmlParsed.Document.length}, Document[0].Story.length=${storyXmlParsed.Document[0].Story.length}, Document[0].Story[0].ParagraphStyleRange.length=${storyXmlParsed.Document[0].Story[0].ParagraphStyleRange.length}`);
    let psrSummaryList: {[key: string]: PSRSummary[] }  = {};
    let lastPsr: any;

    if (storyXMLNullCheck(storyXmlParsed)) {
        try {
            storyXmlParsed.Document[0].Story[0].ParagraphStyleRange.forEach((psr: { CharacterStyleRange: any[]; }, idx: number) => {
                psrSummaryList['PSR_' + idx] = [];
                //console.log(`Document[0].Story[0].ParagraphStyleRange[${idx}]=`);
                //console.log(psr);
                lastPsr = psr;
                if (psr.CharacterStyleRange && psr.CharacterStyleRange.length > 0) {
                    psr.CharacterStyleRange.forEach((csr: any,csrIdx: number) => {
                        //console.log(csr);
                        if (csr.HyperlinkTextDestination
                            && csr.Content
                            && typeof csr.Content === "string"
                        ) {
                            let str = indesignSpecialCharsToASCII(csr.Content);
                            let psrSummary: PSRSummary = {
                                content: str,
                                type: "hyperlink",
                                name: csr.HyperlinkTextDestination["@_Name"],
                                self: csr.HyperlinkTextDestination["@_Self"],
                                csrIdx: csrIdx,
                                contentIdx: 0
                            };
                            psrSummaryList['PSR_' + idx].push(psrSummary);
                        } else if (csr.Content) {
                            if (Array.isArray(csr.Content)) {
                                //console.log('we have a case in which csr.Content is an Array :');
                                //console.log(csr.Content);
                                csr.Content.forEach( (value: string,contentIdx: number) => {
                                    psrSummaryList['PSR_' + idx].push(textToPSRSummary(indesignSpecialCharsToASCII(value),csrIdx,contentIdx));
                                });
                            } else {
                                if (typeof csr.Content === "string") {
                                    psrSummaryList['PSR_' + idx].push(textToPSRSummary(indesignSpecialCharsToASCII(csr.Content),csrIdx,0));
                                }
                            }
                        }
                    });
                }
            });
        } catch (ex) {
            console.warn("Error parsing story at paragraph style range");
            console.warn(JSON.stringify(lastPsr, null, 4));
            console.debug(ex);
        }
    }

    return psrSummaryList;
}

export function indesignSpecialCharsToASCII(str: string): string {
    if(typeof str !== 'string') {
        console.error('we have a case in which str §' + str + '§ is of type ' + typeof str);
        console.log(str);
        return str;
    }
    return str.replace(/\u2028/g, "\r").replace(/\u2029/g, "\n").replace(/\u0009/g, "\t");
}

export function ASCIISpecialCharsToIndesign(str: string): string {
    return str.replaceAll("\r", "\u2028" ).replaceAll("\n", "\u2029" ).replaceAll("\t", "\u0009");
}

export function hyperlinkToHTML(psrSummary: PSRSummary): string {
    //let text = encode(psrSummary.content, { level: 'html5' });
    let id = psrSummary.self;
    if (!id) {
        id = "item-0";
    }
    let title = psrSummary.name;
    return `<a id="${id}" title="${title}">${psrSummary.content}</a>`;
}

export function htmlEntryToTextEntries(translateEntry: TranslationEntry): TranslationEntry[] {
    let textEntries: TranslationEntry[]         = [];
    let domParser: DomParser                    = new DomParser();
    let sourceParsed: DomParser.Dom             = domParser.parseFromString("<html><body>" + translateEntry.sourceText + "</body></html>");
    let translationParsed: DomParser.Dom        = domParser.parseFromString("<html><body>" + translateEntry.text + "</body></html>");
    let sourceLinkElements: DomParser.Node[] | null = sourceParsed.getElementsByTagName("a");
    if( sourceLinkElements !== null && sourceLinkElements.length > 0 ) {
        for (let i: number = 0; i < sourceLinkElements.length; i++) {
            let id: string|null     = sourceLinkElements[i].getAttribute("id");
            if( id !== null ) {
                let sourceText: string  = decode(sourceLinkElements[i].textContent, { level: 'html5' });
                let elId: DomParser.Node|null = translationParsed.getElementById(id);
                if( elId !== null ){
                    let text: string        = decode(elId.textContent, { level: 'html5' });
                    let note: string        = "";
                    if (sourceLinkElements[i].getAttribute("title") !== null) {
                        note = "" + sourceLinkElements[i].getAttribute("title");
                    }
                    textEntries.push({
                        sourceText: sourceText,
                        storyId: translateEntry.storyId,
                        text: text,
                        note: note,
                        type: "text"
                    });
                }
            }
        }
    }
    let sourceSpanElements: DomParser.Node[]|null = sourceParsed.getElementsByTagName("span");
    if( sourceSpanElements !== null && sourceSpanElements.length > 0 ) {
        for (let i: number = 0; i < sourceSpanElements.length; i++) {
            let id: string|null = sourceSpanElements[i].getAttribute("id");
            if( id !== null ) {
                let sourceText: string  = decode(sourceSpanElements[i].textContent, { level: 'html5' });
                let elId: DomParser.Node|null = translationParsed.getElementById(id);
                if( elId !== null ) {
                    let text: string        = decode(elId.textContent, { level: 'html5' });
                    textEntries.push({
                        sourceText: sourceText,
                        storyId: translateEntry.storyId,
                        text: text,
                        note: "",
                        type: "text"
                    });
                }
            }
        }
    }
    return textEntries;
}

export const retrieveICMLFiles = (sourceFolder: string): string[] | boolean => {
    let icmlFiles: string[];
    let sourceFolderFiles: string[] = fs.readdirSync(sourceFolder);
    if( sourceFolderFiles.length ) {
        icmlFiles = sourceFolderFiles.filter((filename) => filename.endsWith(".icml"));
        if( icmlFiles.length ) {
            return icmlFiles;
        } else {
            console.error(`Could not find any ICML files in folder ${sourceFolder}`);
            return false;
        }
    } else {
        console.error(`There don't seem to be any files at all in folder ${sourceFolder}, let alone ICML files`);
        return false;
    }
}

export function getICMLFilePathForName(inputFolder: string, icmlName: string): string|null {
    let inputFilePath: string = path.join(inputFolder, icmlName, icmlName + ".icml");
    if (!fs.existsSync(inputFilePath)) {
        try {
            let actualICMLFilename: string = fs.readdirSync(path.join(inputFolder, icmlName)).filter((filename) => filename.endsWith(".icml"))[0];
            inputFilePath = path.join(inputFolder, icmlName, actualICMLFilename);
        } catch (ex) {
            console.warn("Cannot find any ICML file for folder ", path.join(inputFolder, icmlName));
            return null;
        }
    }
    return inputFilePath;
}

export const extractStringsFromICML = (icmlFiles: string[], sourceFolder: string): object => {
    let sourceTranslation: {[key: string]: { [key: string]: { [key: string]: { [key: string]: string | PSRSummary[]} | PSRSummary[] } } } = {};
    let currentStoryId: string;
    icmlFiles.forEach( (icmlFile) => {
        const icmlIdSeparator           = icmlFile.lastIndexOf('-');
        const icmlId                    = icmlFile.slice(icmlIdSeparator + 1).split('.')[0];
        const icmlFilePath: string      = path.join(sourceFolder, icmlFile);
        const icmlFileContents: string  = fs.readFileSync(icmlFilePath).toString();
        const psrList: {[key: string]: PSRSummary[]}     = extractStoryPSRList(icmlFileContents);

        for(const [key,csrList] of Object.entries(psrList) ) {
            if( icmlId !== currentStoryId ) {
                currentStoryId = icmlId;
                sourceTranslation['Story_' + icmlId] = {};
            }
            sourceTranslation['Story_' + icmlId][key] = {};
            csrList.forEach((csr) => {
                if(/[a-zA-Z]/.test(csr.content)) {
                    let csrKey = 'CSR_' + csr.csrIdx;
                    let finalContent = csr.content;
                    if(csr.type === 'hyperlink') {
                        csrKey = 'CSR_html_' + csr.csrIdx;
                        finalContent = hyperlinkToHTML(csr);
                    }
                    if(sourceTranslation['Story_' + currentStoryId][key].hasOwnProperty(csrKey) === false) {
                        sourceTranslation['Story_' + currentStoryId][key][csrKey] = {};
                    }
                    sourceTranslation['Story_' + currentStoryId][key][csrKey]['Content_' + csr.contentIdx] = finalContent;
                }
            });
            sourceTranslation['Story_' + icmlId][key]['src'] = csrList;
        }
    });
    return sourceTranslation;
}


export const validIsoCodes = [ "aa", "ab", "af", "am", "ar", "as", "ay", "az", "ba", "be", "bg", "bh", "bi", "bn",
 "bo", "ca", "co", "cs", "cy", "da", "de", "dz", "el", "en", "eo", "es", "et", "eu", "fa", "fi", "fj", "fo", "fr",
 "fy", "ga", "gl", "gn", "gu", "ha", "he", "hi", "hr", "hu", "hy", "ia", "id", "ik", "is", "it", "iu", "ja", "jv",
 "ka", "kk", "kl", "km", "kn", "ko", "ks", "ku", "ky", "la", "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn",
 "mr", "ms", "mt", "my", "na", "ne", "nl", "no", "oc", "om", "or", "pa", "pl", "ps", "pt", "qu", "rm", "rn", "ro",
 "ru", "rw", "sa", "sd", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw", "ta", "te",
 "tg", "th", "ti", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ug", "uk", "ur", "uz", "vi", "vo", "wo", "xh",
 "yi", "yo", "za", "zh", "zu"
];

export function isValidIso(isoCode: string): boolean {
    return validIsoCodes.includes(isoCode);
}
