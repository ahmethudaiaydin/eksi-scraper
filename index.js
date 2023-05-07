(function () {
  var cors_api_host = 'cors-anywhere.herokuapp.com';
  var cors_api_url = 'https://' + cors_api_host + '/';
  var slice = [].slice;
  var origin = window.location.protocol + '//' + window.location.host;
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    var args = slice.call(arguments);
    var targetOrigin = /^https?:\/\/([^\/]+)/i.exec(args[1]);
    if (targetOrigin && targetOrigin[0].toLowerCase() !== origin &&
      targetOrigin[1] !== cors_api_host) {
      args[1] = cors_api_url + args[1];
    }
    return open.apply(this, args);
  };
})();


var cors_api_url = 'https://cors-anywhere.herokuapp.com/';

const getTopicList = async (url, pageNumber) => {
  const urlWithPage = pageNumber == 1 ? url : `${url}&p=${pageNumber}`;
  try {
    const response = await fetch(cors_api_url + urlWithPage);
    const htmlString = await response.text();
    const parsedObject = jQuery.parseHTML(htmlString);

    const topics = Array.from($('#content-body >.topic-list li', parsedObject)).map((el) => {
      const href = 'eksisozluk2023.com' + $(el).find('a').attr('href');
      const text = $(el).find('a').text().replace(/\n|\r/g, '').trim();
      return { text, href };
    });
    
    return topics;
  } catch (err) {
    console.error(err);
  }
};

const getPageCountFromEntryPage = (parsedObject) => parseInt($('.pager', parsedObject).first().attr('data-pagecount'));
const getPageCountFromTopicPage = (parsedObject) => 5;


const getEntryList = async (topicUrl, topic) => {
  try {
    console.log(`Retrieve entries for topic: ${topic} page 1.`);
    const response = await fetch(cors_api_url + topicUrl);
    const htmlString = await response.text();
    const parsedObject = jQuery.parseHTML(htmlString);
    let entryList = scrapEntryData(parsedObject);
    
    const pageCount = getPageCountFromEntryPage(parsedObject);
    
    console.log(`Page count for topic ${topic}: ${pageCount}.`);
    for (let i = 2; i <= pageCount; i++) {

      let urlWithPage = `${topicUrl}?p=${i}`;
      console.log(`Retrieve entries for topic: ${topic} page ${i}.`);
      const response = await fetch(cors_api_url + urlWithPage);
      const htmlString = await response.text();
      const parsedObjectForPage = jQuery.parseHTML(htmlString);
      entryList = entryList.concat(scrapEntryData(parsedObjectForPage));
      console.log(`Entries added to topic: ${topic} for page ${i}.`);
    }

    return entryList.map((e) => {
      return { ...e, topic: topic }
    });

  } catch (err) {
    console.error(err);
  }
};

let debugObj = null;
const scrapEntryData = (parsedObject) => {
  debugObj= parsedObject;
  const entries = Array.from($('#entry-item-list li', parsedObject)).map((el) => {
    const date = $(el).find(".entry-date").text().trim();
    const author = $(el).find(".entry-author").text().trim();
    const text = $(el).find(".content").text().trim();
    return { date, author, text };
  });

  return entries;
};

const convertToCSV = (objArray) => {
  // Create an array of column names
  const columnNames = Object.keys(objArray[0]);

  // Create an array of rows, where each row is an array of column values
  const rows = objArray.map(obj => {
    return columnNames.map(name => obj[name]);
  });

  // Add the column names as the first row of the CSV
  rows.unshift(columnNames);

  // Convert the array to CSV string
  const csv = rows.map(row => row.join(',')).join('\n');

  return csv;
}

const createCsvFile = (objArray, filename) => {
  var dataArray = convertToCSV(objArray);
  const blob = new Blob([dataArray], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
  
}

const setTopicTableProcessing = (value) => {
  topicTable.settings()[0].oInit.processing = value;
  topicTable.draw();
}

const scrap = async (text) => {
  const topicURL =
    `https://eksisozluk2023.com/basliklar/ara?SearchForm.Keywords=${text}&SearchForm.Author=&SearchForm.When.From=&SearchForm.When.To=&SearchForm.NiceOnly=false&SearchForm.SortOrder=Count`;
  console.log("Starting to get topics...");
  finalTopicList = [];
  topicTable.clear().rows.add(finalTopicList).draw();

  

  const topicPageCount = getPageCountFromTopicPage(null); // 10
  console.log(`Topic page count: ${topicPageCount}`);

  console.log(`Starting to get topics...`);
  for (let index = 1; index <= topicPageCount; index++) {

    const newPageList = await getTopicList(topicURL, index);

    finalTopicList = finalTopicList.concat(newPageList);
    console.log(`${index}/${topicPageCount}`);
  }

  topicTable.clear().rows.add(finalTopicList).draw();
  
  console.log(`All topics were added to topic list. Total topic count: ${finalTopicList.length}`);

  console.log(`Starting to retrieve entries for all topics...`);
  let finalEntryList = [];

  for (let i = 0; i < finalTopicList.length; i++) {
    const topic = finalTopicList[i];
    console.log(
      `Getting entries for topic: ${topic.text} from ${topic.href}`
    );
    const entries = await getEntryList(topic.href, topic.text);
    finalEntryList = finalEntryList.concat(entries);
    console.log(
      `Entries collected for topic ${topic.text} for all pages and added to final list.`
    );
  }

  console.log(
    `All entries are collected. Starting to write CSV file: entries.csv`
  );
  
  createCsvFile(finalEntryList, $`{text}.csv`);
};

let finalTopicList = [];
let topicTable = null;
$(document).ready(() => {
  captureConsoleLogs();
  
  topicTable = $('#topic-table').DataTable({
    data: finalTopicList,
    columns: [
      { data: 'text', title: 'Topic' },
      { data: 'href', title: 'Link' },
    ],
  });
})



const captureConsoleLogs = () => {
  const consoleLogDiv = document.getElementById('console-log');
  const oldConsoleLog = console.log;
  console.log = function() {
    for (let i = 0; i < arguments.length; i++) {
      const newDiv = document.createElement('div');
      newDiv.textContent = arguments[i];
      consoleLogDiv.appendChild(newDiv);
    }
    oldConsoleLog.apply(console, arguments);
  };
  console.log('Console logs are being captured.');
}