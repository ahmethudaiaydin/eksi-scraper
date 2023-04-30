const request = require("request-promise");
const cheerio = require("cheerio");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');


const getTopicList = async (url, pageNumber) => {
  const urlWithPage = pageNumber == 1 ? url : `${url}&p=${pageNumber}`;
  try {
    const html = await request(urlWithPage);
    const $ = cheerio.load(html);

    const topics = $('#content-body >.topic-list li').map((i, el) => {
      const href = 'https://eksisozluk2023.com' + $(el).find('a').attr('href');
      const text = $(el).find('a').text().replace(/\n|\r/g, '').trim();;
      return { href, text };
    }).get();
    return topics;
  } catch (err) {
    console.error(err);
  }
}

const getPageCountFromEntryPage = ($) => parseInt($('.pager').first().attr('data-pagecount'));
const getPageCountFromTopicPage = ($) => 10;


const getEntryList = async (topicUrl, topic) => {
  try {
    console.log(`Retrieve entries for topic: ${topic} page 1.`)
    let html = await request(topicUrl); //First request to get data and pageCount as well.
    let $ = cheerio.load(html);
    let entryList = scrapEntryData($);

    const pageCount = getPageCountFromEntryPage($);
    console.log(`Page count for topic ${topic}: ${pageCount}.`)
    for (let i = 2; i <= pageCount; i++) {

      let urlWithPage = `${topicUrl}?p=${i}`;
      console.log(`Retrieve entries for topic: ${topic} page ${i}.`)
      html = await request(urlWithPage);
      $ = cheerio.load(html);
      entryList = entryList.concat(scrapEntryData($));
      console.log(`Entries added to topic: ${topic} for page ${i}.`)
    }

    return entryList.map((e) => {
      return { ...e, topic: topic }
    });
    
  } catch (err) {
    console.error(err);
  }
}

const scrapEntryData = ($) => {
  const entries = $('#entry-item-list > li').map((i, el) => {
    const date = $(el).find("#entry-item .entry-date").text().trim();
    const author = $(el).find("#entry-item .entry-author").text().trim();
    const text = $(el).find("#entry-item .content").text().trim();
    return { date, author, text };
  }).get();

  return entries;
}

const createCsvFile = (dataArray, filename) => {

  const csvWriter = createCsvWriter({
    path: filename,
    header: [
      { id: 'topic', title: 'Başlık' },
      { id: 'date', title: 'Tarih' },
      { id: 'author', title: 'Yazar' },
      { id: 'text', title: 'Entry' },
    ]
  });

  csvWriter.writeRecords(dataArray)
    .then(() => {
      console.log(`CSV file ${filename} has been created successfully.`);
    })
    .catch((err) => {
      console.error(`Error creating CSV file ${filename}: ${err}`);
    });
}


const scrap = async () => {

  const topicURL = 'https://eksisozluk2023.com/basliklar/ara?SearchForm.Keywords=sedat+peker&SearchForm.Author=&SearchForm.When.From=&SearchForm.When.To=&SearchForm.NiceOnly=false&SearchForm.SortOrder=Count';
  console.log('Starting to get topics...');
  let finalTopicList = [];
  const topicPageCount = getPageCountFromTopicPage(null); // 10

  console.log(`Topic page count: ${topicPageCount}`);

  for (let index = 1; index <= topicPageCount; index++) {
    console.log(`Retrieve page ${index} topics...`);

    const newPageList = await getTopicList(topicURL, index);

    console.log(`Page ${index} topic count: ${newPageList.length}`);

    finalTopicList = finalTopicList.concat(newPageList);
    console.log(`Page ${index} topics are added to base topic list. Total topic count: ${finalTopicList.length}`);

  }
  console.log(`All topics were added to topic list. Total topic count: ${finalTopicList.length}`);
  console.log(`Starting to retrieve entries for all topics...`);

  let finalEntryList = [];
  for (let i = 0; i < finalTopicList.length; i++) {
    const topic = finalTopicList[i];
    console.log(`Getting entries for topic: ${topic.text} from ${topic.href}`);

    const entries = await getEntryList(topic.href, topic.text);
    finalEntryList =  finalEntryList.concat(entries);
    console.log(`Entries collected for topic ${topic.text} for all pages and added to final list.`);

  }

  console.log(`All entries are collected. Starting to write CSV file: entries.csv`);
  createCsvFile(finalEntryList, 'entries.csv');

}

scrap();
