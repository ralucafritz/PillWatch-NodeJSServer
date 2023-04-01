const express = require("express");
const app = express();
const port = 3000;

const excelToJson = require("convert-excel-to-json");
const axios = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");

// data set for 10 obj
// const dataJson = "dataSmall.json";
// const excelFile = "nomSmall.xlsx";

// data set for 265 obj
const dataJson = "dataMedium.json";
const excelFile = "nomMedium.xlsx";

// data set for 32240 obj
// const dataJson = "data.json";
// const excelFile = "nomenclator.xlsx";

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// localhost:3000/getData
app.get("/getData", (req, res) => {
  // read the Excel file and convert it to JSON objects
  res.send(
    excelToJson({
      sourceFile: excelFile,
      header: {
        rows: 1,
      },
    })["Worksheet"].map((el) => {
      return {
        // JSON columns
        "CIM Code": el["A"],
        "Trade name": el["B"],
        DCI: el["C"],
        "Dosage Form": el["D"],
        Concentration: el["E"],
        "ATC Code": el["H"],
        "Prescription Type": el["J"],
        "Package volume": el["M"],
        "Last Update Date": el["T"],
      };
    })
  );
});

function logObjCheckStatus(status, number) {
  if (status) {
    console.log(`No.${number} retrieved successfully.`);
  } else {
    // error message
    console.log(`No.${number} could not be found in the NIH database or it doesn't have an ATC code.`);
  }
}

const dictAtcCode = {};

// localhost:3000/getFinalData
app.get("/getFinalData", async (req, res) => {
  // call // localhost:3000/getData to retrieve the data
  axios
    .get("http://localhost:3000/getData")
    .then(async (response) => {
      try {
        // start timer
        const start = Date.now();

        // init empty arra of objects
        const newData = [];

        // init empty array of atcCodes that don't need to be checked again
        const atcCodesWithoutRxCuiOrInvalid = [];

        // init numbers for checking purposes
        let number = 2;

        // go through the entire dataset
        for (const obj of response.data) {
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
            logObjCheckStatus(false, number);
            number++;
            continue;
          }

          let rxCui;

          // check if the RxCui was already requested for this ATC Code
          if (Object.keys(dictAtcCode) != undefined && Object.keys(dictAtcCode).includes(atcCode)) {
            rxCui = dictAtcCode[atcCode];
          } else {
            // get RxCui based on the atc code
            rxCui = await getRxCuiByAtcCode(atcCode.toString());
            // if RxCui received is null => the code is not in the NIH database
            if (rxCui === null) {
              atcCodesWithoutRxCuiOrInvalid.push(atcCode);
              // log err msg and increment
              logObjCheckStatus(false, number);
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
          logObjCheckStatus(true, number);
          number++;

          // push the new created object into the array
          newData.push(newObj);
        }

        // write the new data in a JSON file
        writeData(newData);

        // return the array as json
        res.json(newData);

        // end timer
        const end = Date.now();

        getExecutionTime(start, end);

      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    })
    .catch((error) => {
      console.error("Error retrieving data:", error);
    });
});

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

// write data to json file function
function writeData(data) {
  fs.writeFileSync(dataJson, JSON.stringify(data), "utf-8");
}

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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
