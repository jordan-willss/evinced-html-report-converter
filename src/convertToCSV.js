import fs from "fs";
import * as path from 'path';
import {unified} from "unified";
import rehypeParse from "rehype-parse";
import rehypeFormat from "rehype-format";
import rehypeStringify from "rehype-stringify";
import {createReadStream} from "streamifier";
import readline from "readline";

format().then(result => console.log(result));

async function format() {
    formatHtmlContent('./report.html').then(async data => {
        await convertToCsv(data);
    });
}

async function trimHtmlContent(path) {
    return new Promise((resolve, reject)  => {
        fs.readFile(path, 'utf-8', (async (err, data) => {
            err ? reject(err) : null;
            data = replaceAttribute(data, 'src');
            data = removeTag(data, 'style');
            data = removeTag(data, 'head');
            data = removeTag(data, 'header');
            data = removeTag(data, 'script');
            resolve(data);
        }))
    })
}

async function formatHtmlContent(path) {
    return new Promise(async (resolve, reject) => {
        try {
            trimHtmlContent(path).then(async data => {
                let file = await unified()
                    .use(rehypeParse)
                    .use(rehypeFormat)
                    .use(rehypeStringify)
                    .process(await data);
                resolve(String(file));
            })
        } catch (e) {
            reject(e);
        }
    })
}

async function convertToCsv(buffer) {
    const fileStream = createReadStream(buffer);
    let nArr;
    let arr = [];

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        arr.push(line);
    }

    nArr = await lineSorter(arr);

    await fs.writeFile('report.csv', String(nArr), err => err ? console.log(err) : null)
}

async function lineSorter(lines) {
    let values = [];
    let vIncrement = 0;
    let hIncrement = 0;
    const informationExp = /(?<=>)[0-9|a-zA-Z|. ,:\/()\-_@]+(?=<)/;

    return new Promise((resolve, reject) => {
        let value = [];
        let numStr = '';
        lines.forEach(line => {
            if (String(line).match(informationExp)) {
                line = line.replaceAll(/,/g, '');
                let arr = informationExp.exec(line);
                if (arr[0].match(/Class Name:/g)) {
                    value.splice(0, 1);
                    value.splice(1, 1);
                    value.splice(2, 1);
                    value.splice(4, 0, numStr);
                    vIncrement >= 1 ? value[0] = '\n' + value[0] : null;
                    vIncrement !== 0 ? values.push(value) : values.push(['Class Name', 'View ID', 'Content Description', 'Accessibility Issue', 'Affected Areas', 'Type of Issue', 'Level of Concern']);
                    vIncrement++;

                    // Reset Increments
                    hIncrement = 0;
                    value = [];
                    numStr = '';
                }

                // hIncrement needs to be incremented for each splice!
                if(hIncrement === 2 && !String(line).match(/View ID:/g)) {
                    value.splice(2, 0, '');
                    value.splice(2, 0, '');
                    hIncrement += 2;
                }
                if (hIncrement === 4 && !String(line).match(/Content Description:/g)) {
                    value.splice(4, 0, '');
                    value.splice(4, 0, '');
                    hIncrement += 2;
                }
                if (hIncrement === 6 && arr[0].match(/^[0-9]+$/g)) {
                    value.splice(6, 0, '');
                    hIncrement++;
                }
                if (arr[0].match(/^[0-9]+$/g)) {
                    numStr === '' ? numStr += arr[0] : numStr += `_${arr[0]}`
                }

                // Don't push integers here, they're added to numStr and pushed to index 7 of value at the end
                !arr[0].match(/^[0-9]+$/g) ? value.push(arr[0]) : null;

                hIncrement++;
            }
        })
        resolve(values);
    })
}

function removeTag(str, tagName) {
    let exp = new RegExp(`<${tagName}+[\\s\\S]+<\\/${tagName}>`, 'g');
    return str.replaceAll(exp, '');
}

function replaceAttribute(str, attribute) {
    let exp = new RegExp(`${attribute}="[\\s\\S]+?"`, 'g');
    return str.replaceAll(exp, `${attribute}="replaced"`);
}