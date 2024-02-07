
console.log('environment variables passed to script:');
console.log(process.env);

console.log('arguments passed to script:');
// print process.argv
var argv = require('minimist')(process.argv.slice(2));
console.log(argv);

let icmlFolder: string = argv['source-folder'] ?? process.env.ICML_FOLDER_LOCATION ?? "./InCopy";
console.log('source folder = ' + icmlFolder);
