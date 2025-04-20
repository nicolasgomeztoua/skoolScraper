// <<< REPLACE your existing Apps Script code with this >>>

// Headers for the original scraped data sheets
const REQUIRED_HEADERS = [
  "id",
  "problem",
  "originalContent",
  "suggestedSolution",
  "tags",
  "category",
  "status",
  "timestamp",
  "authorName",
  "postTimestamp",
  "postUrl",
  "communityUrl",
];

// Headers for the AI-generated posts sheets
const GENERATED_POST_HEADERS = [
  "originalPostId",
  "originalContentSnippet",
  "generatedTitle",
  "generatedContent",
  "generationTimestamp",
  "status", // Status like 'Draft', 'Needs Review'
];

/**
 * Handles HTTP GET requests.
 * Actions: getIds, getSheetData
 */
function doGet(e) {
  let responseData = {};
  let errorMessage = null;

  try {
    if (!e || !e.parameter) throw new Error("Request parameters are missing.");
    const action = e.parameter.action;
    const sheetName = e.parameter.sheet;

    if (!sheetName || sheetName.trim() === "")
      throw new Error("Missing or empty 'sheet' parameter.");
    if (!action || action.trim() === "")
      throw new Error("Missing or empty 'action' parameter.");

    const safeSheetName = sheetName.trim();

    switch (action) {
      case "getIds":
        const ids = getExistingIds_(safeSheetName);
        responseData = { existingIds: Array.from(ids) };
        Logger.log(
          `Action: getIds for sheet '${safeSheetName}'. Found ${ids.size} IDs.`
        );
        break;
      case "getSheetData": // New action
        const data = getSheetData_(safeSheetName);
        responseData = { sheetData: data };
        Logger.log(
          `Action: getSheetData for sheet '${safeSheetName}'. Found ${
            data.length - 1
          } data rows.`
        ); // -1 for header
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  } catch (error) {
    Logger.log(
      `Error in doGet: ${error.message} - Parameters: ${
        e && e.parameter ? JSON.stringify(e.parameter) : "undefined"
      }`
    );
    errorMessage = error.message;
    responseData = { error: errorMessage };
  }

  return ContentService.createTextOutput(
    JSON.stringify(responseData)
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles HTTP POST requests.
 * Actions: saveData, updateStatus
 */
function doPost(e) {
  let responseData = {};
  let errorMessage = null;

  try {
    if (!e || !e.parameter) throw new Error("Request parameters are missing.");
    const action = e.parameter.action;
    const sheetName = e.parameter.sheet;

    if (!sheetName || sheetName.trim() === "")
      throw new Error("Missing or empty 'sheet' parameter.");
    if (!action || action.trim() === "")
      throw new Error("Missing or empty 'action' parameter.");

    // Ensure postData exists for actions that need it
    if (
      (action === "saveData" || action === "updateStatus") &&
      (!e.postData || !e.postData.contents)
    ) {
      throw new Error("Missing POST data body for action: " + action);
    }

    const requestBody =
      e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const safeSheetName = sheetName.trim();

    switch (action) {
      case "saveData":
        // Determine headers based on sheet name convention
        const headers = safeSheetName.startsWith("posts-")
          ? GENERATED_POST_HEADERS
          : REQUIRED_HEADERS;
        if (!requestBody.data || !Array.isArray(requestBody.data)) {
          throw new Error(
            'Invalid POST body for saveData. Expected { "data": [...] }'
          );
        }
        const numSaved = appendData_(safeSheetName, requestBody.data, headers);
        responseData = { created: numSaved };
        Logger.log(
          `Action: saveData for sheet '${safeSheetName}'. Saved ${numSaved} rows.`
        );
        break;
      case "updateStatus": // New action
        if (!requestBody.postId || !requestBody.newStatus) {
          throw new Error(
            'Invalid POST body for updateStatus. Expected { "postId": "...", "newStatus": "..." }'
          );
        }
        const success = updateStatus_(
          safeSheetName,
          requestBody.postId,
          requestBody.newStatus
        );
        responseData = { success: success };
        Logger.log(
          `Action: updateStatus for sheet '${safeSheetName}', postId '${requestBody.postId}'. Success: ${success}`
        );
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  } catch (error) {
    Logger.log(
      `Error in doPost: ${error.message} - Parameters: ${
        e && e.parameter ? JSON.stringify(e.parameter) : "undefined"
      } - PostData: ${
        e.postData ? e.postData.contents.substring(0, 200) + "..." : "null"
      }`
    );
    errorMessage = error.message;
    responseData = { error: errorMessage };
  }

  return ContentService.createTextOutput(
    JSON.stringify(responseData)
  ).setMimeType(ContentService.MimeType.JSON);
}

// --- Helper Functions ---

/**
 * Gets the sheet by name. Creates it with specified headers if it doesn't exist.
 * Returns the Sheet object. Uses getActiveSpreadsheet() for BOUND scripts.
 */
function getSheet_(sheetName, headersArray) {
  if (!sheetName || sheetName.trim() === "")
    throw new Error("getSheet_ called with empty sheet name.");
  if (
    !headersArray ||
    !Array.isArray(headersArray) ||
    headersArray.length === 0
  )
    throw new Error("getSheet_ called without valid headersArray.");

  const safeSheetName = sheetName.trim();
  // Use getActiveSpreadsheet() for scripts bound to a sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    // This should theoretically not happen for a bound script, but check anyway
    Logger.log(
      "Error: Could not get active spreadsheet. Is the script bound correctly?"
    );
    throw new Error("Could not get active spreadsheet.");
  }

  let sheet = ss.getSheetByName(safeSheetName);

  if (!sheet) {
    Logger.log(`Sheet '${safeSheetName}' not found. Creating it...`);
    sheet = ss.insertSheet(safeSheetName);
    SpreadsheetApp.flush();
    sheet = ss.getSheetByName(safeSheetName); // Re-fetch after creation
    if (!sheet) throw new Error(`Failed to create sheet '${safeSheetName}'.`);

    if (sheet.getLastRow() === 0) {
      try {
        sheet.getRange(1, 1, 1, headersArray.length).setValues([headersArray]);
        Logger.log(`Headers written to new sheet '${safeSheetName}'.`);
      } catch (headerError) {
        Logger.log(
          `Error writing headers to new sheet '${safeSheetName}': ${headerError.message}`
        );
        throw new Error(
          `Failed to write headers to new sheet '${safeSheetName}'. Error: ${headerError.message}`
        );
      }
    } else {
      Logger.log(
        `Sheet '${safeSheetName}' created but not empty (LastRow: ${sheet.getLastRow()}). Headers not written.`
      );
    }
  } else {
    Logger.log(`Sheet '${safeSheetName}' already exists.`);
    try {
      // Check/fix headers if sheet already exists
      const headerRange = sheet.getRange(1, 1, 1, headersArray.length);
      const currentHeaders = headerRange.getValues()[0];
      if (
        !currentHeaders ||
        currentHeaders.length < headersArray.length ||
        currentHeaders[0] !== headersArray[0]
      ) {
        Logger.log(
          `Headers in sheet '${safeSheetName}' seem incorrect/missing. Attempting to write/overwrite.`
        );
        headerRange.setValues([headersArray]);
        Logger.log(
          `Headers possibly corrected in existing sheet '${safeSheetName}'.`
        );
      }
    } catch (headerCheckError) {
      Logger.log(
        `Error checking/writing headers for existing sheet '${safeSheetName}': ${headerCheckError.message}.`
      );
    }
  }
  return sheet;
}

/**
 * Gets existing IDs from the 'id' column (assuming first column).
 */
function getExistingIds_(sheetName) {
  // Pass REQUIRED_HEADERS as default for getting IDs (acts on original sheets)
  const sheet = getSheet_(sheetName, REQUIRED_HEADERS);
  const lastRow = sheet.getLastRow();
  const idSet = new Set();
  if (lastRow <= 1) return idSet;

  try {
    const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
    const idValues = idRange.getValues();
    for (let i = 0; i < idValues.length; i++) {
      const id = idValues[i][0];
      if (id && typeof id === "string" && id.trim() !== "") {
        idSet.add(id.trim());
      } else if (id !== null && id !== undefined && id !== "") {
        Logger.log(
          `Non-string/empty ID in '${sheetName}' row ${
            i + 2
          }: Val='${id}', Type=${typeof id}`
        );
      }
    }
  } catch (rangeError) {
    Logger.log(
      `Error reading ID range from sheet '${sheetName}': ${rangeError.message}. LastRow=${lastRow}.`
    );
    throw new Error(
      `Failed to read IDs from sheet '${sheetName}'. Error: ${rangeError.message}`
    );
  }
  return idSet;
}

/**
 * Gets all data from a sheet, excluding the header row.
 */
function getSheetData_(sheetName) {
  // Pass REQUIRED_HEADERS as default when getting data (acts on original sheets)
  const sheet = getSheet_(sheetName, REQUIRED_HEADERS);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    Logger.log(`Sheet '${sheetName}' has no data rows to fetch.`);
    return []; // Return empty array if only header exists
  }
  try {
    // Get data starting from row 2 to exclude headers
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const data = dataRange.getValues();
    return data;
  } catch (rangeError) {
    Logger.log(
      `Error reading data range from sheet '${sheetName}': ${rangeError.message}. LastRow=${lastRow}, LastCol=${lastCol}.`
    );
    throw new Error(
      `Failed to read data from sheet '${sheetName}'. Error: ${rangeError.message}`
    );
  }
}

/**
 * Appends rows of data to the specified sheet. Uses provided headers for validation.
 */
function appendData_(sheetName, data, headersArray) {
  if (!data || !Array.isArray(data) || data.length === 0) return 0;

  const sheet = getSheet_(sheetName, headersArray); // Ensure sheet exists with correct headers

  if (!Array.isArray(data[0]) || data[0].length !== headersArray.length) {
    const actualCols = Array.isArray(data[0]) ? data[0].length : "Not an array";
    Logger.log(
      `AppendData Error: Column count mismatch in sheet '${sheetName}'. Expected ${headersArray.length}, got ${actualCols}.`
    );
    throw new Error(
      `Data column count (${actualCols}) does not match header count (${headersArray.length}).`
    );
  }

  try {
    const startRow = sheet.getLastRow() + 1;
    const numRows = data.length;
    const numCols = headersArray.length;
    sheet.getRange(startRow, 1, numRows, numCols).setValues(data);
    Logger.log(`Appended ${numRows} rows to sheet '${sheetName}'.`);
    return numRows;
  } catch (error) {
    Logger.log(
      `Error appending data to sheet '${sheetName}': ${error.message}.`
    );
    throw new Error(
      `Failed to append data to sheet '${sheetName}'. Error: ${error.message}`
    );
  }
}

/**
 * Updates the status column for a specific post ID.
 * Assumes status is the 7th column (index 6) based on REQUIRED_HEADERS.
 */
function updateStatus_(sheetName, postId, newStatus) {
  // Use REQUIRED_HEADERS for finding the original post
  const sheet = getSheet_(sheetName, REQUIRED_HEADERS);
  const statusColumnIndex = REQUIRED_HEADERS.indexOf("status") + 1; // Find index dynamically (1-based)
  if (statusColumnIndex === 0) {
    Logger.log(
      `Error updating status: 'status' column not found in REQUIRED_HEADERS.`
    );
    return false; // Or throw error
  }

  try {
    const idColumnValues = sheet
      .getRange(1, 1, sheet.getLastRow(), 1)
      .getValues();
    let foundRow = -1;
    // Start from 1 to skip header row
    for (let i = 1; i < idColumnValues.length; i++) {
      if (idColumnValues[i][0] === postId) {
        foundRow = i + 1; // 1-based row index
        break;
      }
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, statusColumnIndex).setValue(newStatus);
      Logger.log(
        `Updated status to '${newStatus}' for postId '${postId}' in sheet '${sheetName}' at row ${foundRow}.`
      );
      return true;
    } else {
      Logger.log(
        `Post ID '${postId}' not found in sheet '${sheetName}' for status update.`
      );
      return false;
    }
  } catch (error) {
    Logger.log(
      `Error updating status for postId '${postId}' in sheet '${sheetName}': ${error.message}`
    );
    // Don't throw, just report failure
    return false;
  }
}
