const express = require("express");
const app = express();
const port = 3000;

const excelToJson = require("convert-excel-to-json");
const axios = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// localhost:3000/getData
app.get("/getData", (req, res) => {
  // read the Excel file and convert it to JSON objects
  res.send(
    excelToJson({
      sourceFile: "nomenclator.xlsx",
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

// localhost:3000/getFinalData
app.get("/getFinalData", async (req, res) => {
  // call // localhost:3000/getData to retrieve the data
  axios
    .get("http://localhost:3000/getData")
    .then(async (response) => {
      try {
        // init empty list of objects
        const newData = [];
        let number = 2;
        // go through the entire dataset
        for (const obj of response.data) {
          // extract the `ATC Code` column data from the JSON object
          const atcCode = obj["ATC Code"];

          if (atcCode === undefined) {
            number++;
            console.log(`No.${number} is empty.`);
            continue;
          }
          // get RxCui based on the atc code
          rxCui = await getRxCuiByAtcCode(atcCode.toString());
          if (rxCui === null) {
            console.log(`No.${number} could not be found in the NIH database.`);
            continue;
          }
          // destruct the old object and build a new one with an extra column
          const newObj = {
            ...obj,
            RxCui: rxCui,
          };
          console.log(`No.${number} retrieved successfully.`);
          number++;
          // push the new created object into the array
          newData.push(newObj);
        }

        writeData(newData);
        // return the array as json
        res.json(newData);
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
  //
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
    // response goes through xml parser
    const result = await xml2js.parseStringPromise(res);
    // return the needed xml tag content
    return result.rxnormdata.idGroup[0].rxnormId[0];
  } catch (error) {
    console.error("COULD NOT BE FOUND IN THE DATABASE");
    return null;
  }
}

function writeData(data) {
  fs.writeFileSync("data.json", JSON.stringify(data), "utf-8");
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
