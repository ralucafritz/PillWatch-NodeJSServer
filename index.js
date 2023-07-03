////////////////////////////////// IMPORTS

const express = require("express");
const excelToJson = require("convert-excel-to-json");
const axios = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");
const crypto = require("crypto");
const cron = require("node-cron");
const HTMLParser = require("node-html-parser");
const util = require("./json/util.json");

const server = express();
const port = process.env.PORT || 3000;

// export const api = functions.https.onRequest(server);

server.listen(port, () => {
  // when the server boots up => check if the data is outdated
  // if outdated => replaced
  // commented out for easier testing
  // getNewDataIfOutdated();
  console.log(`Example app listening on port ${port}`);
});

////////////////////////////////// VARIABLES

// Local variables for the excel download location and the page where
// information about the last update date is shown
const DATE_URL = "https://nomenclator.anm.ro/medicamente?page=1";
const DL_URL = "https://nomenclator.anm.ro/files/nomenclator.xlsx";

// variable that loads the last update date from the util json
let lastUpdateDate = new Date(util.lastUpdateDate);

// small data set for 10 obj
// const dataJson = "./json/dataSmall.json";
// const excelFile = "./downloads/nomSmall.xlsx";

// medium data set for 265 obj
// const dataJson = "./json/dataMedium.json";
// const excelFile = "./downloads/nomMedium.xlsx";

// full data set for 32240 obj
const dataJson = "./json/data.json";
const excelFile = "./downloads/nomenclator.xlsx";

////////////////////////////////// API

server.get("/", (req, res) => {
  res.send("Hello World!");
});

// localhost:3000/getConvertedData
server.get("/getConvertedData", (req, res) => {
  // read the Excel file and convert it to JSON objects
  res.send(convertToJson());
});

// localhost:3000/getDatasetJson
server.get("/getDatasetJson", async (req, res) => {
 getDatasetJSON()
});

// localhost:3000/getDataset
server.get("/getDataset", (req, res) => {
  const sha = calculateHash(fs.readFileSync(dataJson));
  res.json({ file: JSON.parse(fs.readFileSync(dataJson, "utf8")), sha });
});

server.get("/getDatasetSha", (req, res) => {
  console.log(
    Object.keys(JSON.parse(fs.readFileSync(dataJson, "utf8"))).length
  );
  const sha = calculateHash(fs.readFileSync(dataJson));
  res.json({ sha });
});

// localhost:3000/getLastUpdateDate
server.get("/getLastUpdateDate", async (req, res) => {
  try {
    // get last update date from the ANM site
    const lastUpdateDate = await getLastUpdateDate();
    // send it as response
    res.send(lastUpdateDate);
  } catch (error) {
    console.error("Error retrieving data:", error);
  }
});

// api for testing purposes
server.get("/getTest", async (req, res) => {
  console.log(
    Object.keys(JSON.parse(fs.readFileSync(dataJson, "utf8"))).length
  );
});

////////////////////////////////// RXCUI FUNCTIONS

async function getDatasetJSON() {
  try {
    // start timer
    const start = Date.now();

    // sorting the meds that can be found in the NIH database
    // and retrieving the RxCui for the meds found
    // adding it as a new collumn
    // also writing the list as a new json file
    const newData = await addRxCuiAndSortMeds(convertToJson());

    // return the array as json
    res.json(newData);

    // end timer
    const end = Date.now();

    getExecutionTime(start, end);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

async function addRxCuiAndSortMeds(data) {
  const dictAtcCode = {};
  // init empty arra of objects
  const newData = [];
  // init empty array of atcCodes that don't need to be checked again
  const atcCodesWithoutRxCuiOrInvalid = [];

  // create map which will verify if a med with the name, dosage and concentration was checked previously
  const map = new Map();

  // init numbers for checking purposes
  let number = 1;

  // init variable to count the number of medicine to get the final precent of medicine saved from the total number of medicine
  let count = 0;

  // go through the entire dataset
  for (const obj of data) {
    obj["Trade name"] = extractMedicationName(obj["Trade name"]);

    // create the map key for the object made out of trade name, dosage form and concentration
    const key = `${obj["Trade name"]},${obj["Concentration"]}`;

    // check if the object is already in the map => skip object
    if (map.has(key)) {
      // log err msg and increment
      logObjCheckStatus(-1, number);
      number++;
      count++;
      continue;
    }

    // extract the `ATC Code` column data from the JSON object
    const atcCode = obj["ATC Code"];

    // check if the object has an `ATC Code` or if the `ATC Code` has already been established as
    // invalid code or a code that doesn't have a RxCui in the NIH database
    if (atcCode === undefined || atcCode in atcCodesWithoutRxCuiOrInvalid) {
      // if the atcCode is not already in the array but it's undefined, it gets added
      if (!(atcCode in atcCodesWithoutRxCuiOrInvalid)) {
        atcCodesWithoutRxCuiOrInvalid.push(atcCode);
      }

      // log err msg and increment
      logObjCheckStatus(1, number);
      number++;
      continue;
    }

    let rxCui;

    // check if the RxCui was already requested for this ATC Code
    if (
      Object.keys(dictAtcCode) != undefined &&
      Object.keys(dictAtcCode).includes(atcCode)
    ) {
      rxCui = dictAtcCode[atcCode];
    } else {
      // get RxCui based on the atc code
      rxCui = await getRxCuiByAtcCode(atcCode.toString());
      // if RxCui received is null => the code is not in the NIH database
      if (rxCui === null) {
        atcCodesWithoutRxCuiOrInvalid.push(atcCode);
        // log err msg and increment
        logObjCheckStatus(1, number);
        number++;
        continue;
      }

      // add the new RxCui to the dictionary
      dictAtcCode[atcCode] = rxCui;
    }

    // destruct the old object and build a new one with an extra column
    const newObj = {
      ...obj,
      RxCui: rxCui,
    };

    // log sucess and increment
    logObjCheckStatus(0, number);
    number++;
    count++;

    // push to the map
    map.set(key, newObj);

    // push the new created object into the array
    newData.push(newObj);
  }

  // write the new data in a JSON file
  writeData(newData);
  console.log(count);
  const precent = ((count * 100) / data.length).toFixed(2);
  console.log(`Medicine count found in the NIH database: ${count} out of ${data.length}.`)
  console.log(`Percentage of medicine found in the NIH database: ${precent} %.`)
  return newData;
}

async function getRxCuiByAtcCode(codATC) {
  // return promise with 50 ms delay before the request is made
  return await new Promise((resolve) =>
    setTimeout(async () => {
      resolve(await getRxCuiFromAPI(codATC));
    }, 50)
  );
}

async function getRxCuiFromAPI(codATC) {
  // send request to the API and parse the response through an xml parser to get the tag needed
  const res = await axios.get(
    `https://rxnav.nlm.nih.gov/REST/rxcui.xml?idtype=ATC&id=${codATC}`
  );
  return await getRxnormId(res.data);
}

async function getRxnormId(res) {
  try {
    // response passes through xml parser
    const result = await xml2js.parseStringPromise(res);

    // return the needed xml tag content
    return result.rxnormdata.idGroup[0].rxnormId[0];
  } catch (error) {
    console.error("Error: MEDICINE COULD NOT BE FOUND IN THE NIH DATABASE");
    return null;
  }
}

function extractMedicationName(name) {
  // split the input string by space characters
  const words = name.split(" ");

  // filter words that contain "mg", "ml", "-", "mg/", "g/", "micrograme/", "MU/", or "mg/ml"
  // filter words that contain digits / floating numbers
  const filteredWords = words.filter((word) => {
    const lowerCaseWord = word.toLowerCase();
    return !(
      /^[-+]?\d+(?:[,.]\d+)?$/.test(word) ||
      lowerCaseWord === "mg" ||
      lowerCaseWord === "ml" ||
      lowerCaseWord === "-" ||
      lowerCaseWord.includes("ui") ||
      lowerCaseWord.includes("%") ||
      lowerCaseWord.includes("mg/") ||
      lowerCaseWord.includes("mg/g") ||
      lowerCaseWord.includes("g/") ||
      lowerCaseWord.includes("micrograme/") ||
      lowerCaseWord.includes("mu/") ||
      lowerCaseWord.includes("mg/ml")
    );
  });

  const medicationName = filteredWords
    .map((word) => toTitleCase(word))
    .join(" ");
  return medicationName.trim() || name;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

////////////////////////////////// API MEDS INTERACTION

server.get("/getInteractionList", async (req, res) => {
  // get the query params from the Retrofit API call
  const { stringParam, listParam } = req.query;

  try {
    // make request
    const response = await getInteractions(stringParam, listParam);
    const interactions = response.fullInteractionTypeGroup;
    let listInteractions = [];
    if (interactions != undefined && interactions != null) {
      interactions.forEach((interaction) => {
        listInteractions.push(
          getFilteredInteractions(interaction.fullInteractionType)
        );
      });
      res.json({ interaction: listInteractions });
    } else {
      res.json({ interaction: null });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

async function getInteractionsResultFromAPI(rxCui, listRxCuis) {
  const apiURL = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=`;
  const rxcuis = [rxCui, ...listRxCuis.toString().split(",")].join("+");
  const sources = `&sources=ONCHigh`;
  const res = await axios.get(apiURL + rxcuis + sources);
  return res.data;
}

async function getInteractions(rxCui, listRxCuis) {
  // return promise with 50 ms delay before the request is made
  return await new Promise((resolve) =>
    setTimeout(async () => {
      resolve(await getInteractionsResultFromAPI(rxCui, listRxCuis));
    }, 50)
  );
}

function getFilteredInteractions(interactions) {
  const filteredInteractions = interactions.filter((interaction) => {
    return interaction.interactionPair.some((pair) => {
      return pair.severity !== "N/A";
    });
  });
  const filteredResults = [];
  filteredInteractions.map((interaction) => {
    const rxcui1 = interaction.minConcept[0].rxcui;
    const rxcui2 = interaction.minConcept[1].rxcui;
    const severity = interaction.interactionPair[0].severity;
    const newInteraction = {
      rxCui1: rxcui1,
      rxCui2: rxcui2,
      severity: severity,
    };
    filteredResults.push(newInteraction);
  });
  return filteredResults;
}

////////////////////////////////// Excel related functions

function convertToJson() {
  return excelToJson({
    sourceFile: excelFile,
    header: {
      rows: 1,
    },
  })["Worksheet"].map((el) => {
    return {
      // JSON columns
      "Trade name": el["B"],
      DCI: el["C"],
      "Dosage Form": el["D"],
      Concentration: el["E"],
      "ATC Code": el["H"],
      "Last Update Date": el["T"],
    };
  });
}

// function used to download the excel file from the preset link
// and rewriting it locally
async function getExcelFile() {
  // access the link
  await axios({ method: "get", url: DL_URL, responseType: "stream" })
    .then((response) => {
      const fileStream = fs.createWriteStream(excelFile);
      // writes the data in chunks
      response.data.pipe(fileStream);
      // on finish, send a log
      fileStream.on("finish", () => {
        console.log(`New excel file saved to ${excelFile}`);
      });
    })
    .catch((err) => {
      console.log(err);
    });
}

////////////////////////////////// Writing to files

// write data to json file function
function writeData(data) {
  fs.writeFileSync(dataJson, JSON.stringify(data), "utf-8");
}

// write the new update date to `util.json`
function writeDateToUtil(receivedDate) {
  const jsonData = fs.readFileSync("./json/util.json", "utf8");

  const data = JSON.parse(jsonData);

  data.lastUpdateDate = receivedDate.getTime();

  fs.writeFileSync("./json/util.json", JSON.stringify(data), "utf-8");

  return receivedDate;
}

////////////////////////////////// Date Related functions

// function retrieves the date the last update was made on the site
async function getLastUpdateDate() {
  // date text selector
  const selector = ".content > div:nth-child(2) > div:nth-child(1)";
  return axios
    .get(DATE_URL)
    .then((res) => {
      // parse the html
      const root = HTMLParser.parse(res.data);
      // select the element needed and split it so we select only the date
      queryDate = root.querySelector(selector).text.split(" ")[2];
      // split the date
      const dateArr = queryDate.split(".");
      // create a new date object and return it
      return new Date(dateArr[2], dateArr[1] - 1, dateArr[0]);
    })
    .catch((error) => {
      console.error(error);
    });
}

// function converts a date to a long number
function dateToLong(queryDate) {
  return new Date(Date.parse(queryDate)).getTime() / 1000;
}

// function checks if there is has been a new update to the list
async function checkDate() {
  // get most recent update date
  receivedDate = await getLastUpdateDate();
  // check if it's more recent than the current one
  if (dateToLong(lastUpdateDate) === dateToLong(receivedDate)) {
    // if it's more recent => rewrite the local variable and the saved date from `util.json`
    writeDateToUtil(receivedDate);
    lastUpdateDate = receivedDate;
    return false;
  }
  {
    return true;
  }
}

// function that checks if the current file is outdated
// if the data is outdated => download a new one and update
async function getNewDataIfOutdated() {
  if (await checkDate()) {
    await getExcelFile();
    await getDatasetJSON();
  }
}

////////////////////////////////// RECURRENT ACTIONS

// minute 00
// hour 02 UTC = 05 UTC+3
// month day *
// month *
// week day 1 - monday
// checks if needs update
cron.schedule("00 02 * * 1", () => {
  getNewDataIfOutdated();
});

////////////////////////////////// UTIL FUNCTIONS

// logging function
function logObjCheckStatus(status, number) {
  switch (status) {
    case 0:
      console.log(`No.${number} retrieved successfully.`);
      break;
    case 1:
      // error message
      console.log(
        `No.${number} could not be found in the NIH database or it doesn't have an ATC code.`
      );
      break;
    case -1:
      // error message
      console.log(`No.${number} already in the system.`);
      break;
    default:
      console.log(`Unknown status for No.${number}`);
  }
}

// execution timer
function getExecutionTime(start, end) {
  // calculate the execution time in ms
  const executionTimeMs = end - start;

  // convert it to hours passed
  const hours = Math.floor(executionTimeMs / (1000 * 60 * 60));

  // convert it to minutes passed
  const minutes = Math.floor(
    (executionTimeMs % (1000 * 60 * 60)) / (1000 * 60)
  );

  // convert it to seconds passed
  const seconds = Math.floor((executionTimeMs % (1000 * 60)) / 1000);

  // log the execution time in hours, minute and seconds
  console.log(`Execution time: ${hours}h ${minutes}m ${seconds}s`);
}

function calculateHash(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

const interaction = {
  rxCui1: "",
  rxCui2: "",
  severity: "",
};
