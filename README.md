# PillWatch NodeJS Server Documentation

PillWatch NodeJS Server is a server application that provides an API for retrieving and interacting with medication data for the Android app PillWatch. The server is built using Node.js and Express, and it uses several other libraries to provide its functionality.

## Table of Contents

- [PillWatch NodeJS Server Documentation](#pillwatch-nodejs-server-documentation)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
  - [Repository Structure](#repository-structure)
  - [Dependencies](#dependencies)
  - [API Endpoints](#api-endpoints)
  - [Functions](#functions)
  - [Development Journey](#development-journey)
  - [Conclusion](#conclusion)
  - [Contributing](#contributing)

## Getting Started

To get started with the application, clone the repository and install the dependencies:

```bash
git clone https://github.com/ralucafritz/PillWatch-NodeJSServer.git
cd PillWatch-NodeJSServer
npm install
```

To start the server, run:

```bash
npm start
```

The server will start on port 3000 by default, but this can be configured by setting the `PORT` environment variable.

## Repository Structure

The repository contains the following main files:

- `index.js`: The main server file that sets up the server and defines the API endpoints.
- `package.json`: Lists the package dependencies for the project.
- `package-lock.json`: Describes the exact tree that was generated when the project was last installed.
- `README.md`: Provides basic information about the project.
- `Procfile`: Used by Heroku to specify the commands that are executed by the app on startup.

## Dependencies

The application has the following dependencies:

- `axios`: A promise-based HTTP client for the browser and Node.js.
- `convert-excel-to-json`: A library for converting Excel data to JSON format.
- `express`: A fast, unopinionated, minimalist web framework for Node.js.
- `fs`: A module that provides an API for interacting with the file system.
- `https`: An HTTP client for Node.js.
- `node-cron`: A task scheduler in pure JavaScript for Node.js based on the cron syntax.
- `node-html-parser`: A fast, forgiving HTML/XML parser with a clear and simple API.
- `xml2js`: A library for parsing and stringifying XML.

## API Endpoints

The server provides several API endpoints:

- `GET /`: Returns a simple "Hello World!" message.
- `GET /getConvertedData`: Reads the Excel file and converts it to JSON objects.
- `GET /getDatasetJson`: Retrieves the dataset in JSON format.
- `GET /getDataset`: Returns the dataset along with a SHA hash of the data.
- `GET /getDatasetSha`: Returns only the SHA hash of the dataset.
- `GET /getLastUpdateDate`: Retrieves the last update date from the ANM site.
- `GET /getTest`: A testing endpoint.
- `GET /getInteractionList`: Retrieves a list of interactions for a given set of medications.

## Functions

The application includes several functions that provide its core functionality:

- `getDatasetJSON()`: Retrieves the dataset in JSON format.
- `addRxCuiAndSortMeds(data)`: Adds RxCui to the dataset and sorts the medications.
- `getRxCuiByAtcCode(codATC)`: Retrieves the RxCui for a given ATC code.
- `getRxCuiFromAPI(codATC)`: Retrieves the RxCui for a given ATC code from the API.
- `getRxnormId(res)`: Retrieves the Rxnorm ID from the API response.
- `extractMedicationName(name)`: Extracts the medication name from a string.
- `toTitleCase(str)`: Converts a string to title case.
- `getInteractions(stringParam, listParam)`: Retrieves a list of interactions for a given set of medications.
- `getInteractionsResultFromAPI(rxCui, listRxCuis)`: Retrieves a list of interactions for a given set of medications from the API.
- `getFilteredInteractions(interactions)`: Filters the interactions to only include those with a severity level.
- `convertToJson()`: Converts the Excel file to JSON format.
- `getExcelFile()`: Downloads the Excel file from the ANM site.
- `writeData(data)`: Writes data to a JSON file.
- `writeDateToUtil(receivedDate)`: Writes the last update date to `util.json`.
- `getLastUpdateDate()`: Retrieves the last update date from the ANM site.
- `dateToLong(queryDate)`: Converts a date to a long number.
- `checkDate()`: Checks if the data is outdated.
- `getNewDataIfOutdated()`: Checks if the data is outdated and downloads a new Excel file if necessary.

## Development Journey

The development of the PillWatch NodeJS Server was a journey of continuous improvement, feature additions, and changes. Here's a chronological overview of the development process based on the Pull Requests created.

1. **Initial Speed and Efficiency Improvements:** The first phase of development focused on improving the speed and efficiency of the application. The processing time for JSON objects was significantly reduced, and checks were added to prevent unnecessary API calls with invalid data or for ATC Codes that had already been retrieved from the NIH database.

2. **Code Cleanup and Dataset Addition:** The code was cleaned up to improve readability and maintainability. Additionally, a medium dataset excel that was missed in the previous commit was added to the repository.

3. **Feature Additions:** New features were added to enhance the functionality of the application. These included the ability to create a hash for the dataset, a `GET` API to retrieve the dataset along with the SHA, and corrections to the format for the dataset JSON.

4. **Security and Update Checks:** SSL certificates were added to secure communication. An API was added to check the last update date from the ANM page. Scheduled checks for new updates from ANM were implemented to occur every Monday at 5am, and a startup check for new updates from ANM was added.

5. **Code Cleanup and Organizational Improvements:** Further code cleanup was performed, and the code was reorganized for better maintainability. Special folders were created for downloads files, json files, and cert files. A `util.json` file was created for storing data needed when the app reboots.

6. **Changes for Compatibility and Parsing:** SSL was removed due to self-signed SSL incompatibility with Android devices. JSON parsing was added before sending the dataset along with the SHA, so that the JSON objects are read by `moshi` as `MedsDataProperty` in Android.

7. **API for Medication Interaction:** An API for medication interaction was added, and a severity level was included in the response.

8. **API Response Update:** The API response was updated to be of type `List<List<InteractionObject>>` instead of `List<List<List<String>>>`.

9. **Name Formatting and Duplicate Checks:** Name formatting was added to remove 'mg', 'MU', 'ml' and varieties from the trade name that will be used to search the medicine needed. A name and concentration check was added to avoid saving duplicates.

10. **Interaction Check Bug Fix and Concentration Units:** An interaction check bug fix was added in case there are no results in the API. More cases for concentration units were added so they get removed from the `tradeName` of the medication before the excel gets converted to JSON.

11. **Deployment and Logging Feature:** The app was deployed to Heroku. The `Check for outdated medical information` feature was activated on startup and the time for the weekly update was changed. Multiple medication tradename formatting options were added. A logging feature was added to calculate the percentage of medicine from the ANM(Romanian National Association of Medication) found in the NIH(National Institute of Health US) database.

## Conclusion

The PillWatch NodeJS Server is a robust and efficient server application that provides an API for retrieving and interacting with medication data. It has been developed with a focus on speed, efficiency, and usability, and it continues to be improved and updated to meet the needs of its users.


## Contributing
Contributions to the project are welcome. Please fork the repository and create a pull request with your changes.
