require("dotenv").config();
require("./connect-db");
const fs = require('fs');
const path = require('path');
const { IamAuthenticator } = require('ibm-watson/auth');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const Transcription = require('./models/Transcription');

const speechToText = new SpeechToTextV1({
  authenticator: new IamAuthenticator({
    apikey: process.env.SPEECH_TO_TEXT_IAM_APIKEY,
  }),
  serviceUrl: process.env.SPEECH_TO_TEXT_URL,
});

const params = {
  objectMode: true,
  contentType: 'audio/mp3',
  model: 'es-ES_BroadbandModel', // es-ES_NarrowbandModel
  keywords: ['reina', 'museo', 'arte'],
  keywordsThreshold: 0.5,
  timestamps: true,
};

fs.readdir('./audio/', async (err, files) => {
  const savedFiles = await Transcription.find({});
  const filesToRecognize = files.filter(file => path.extname(file) === '.mp3' && !savedFiles.some(f => f.file === file));

  filesToRecognize.forEach(file => {
    // Create the stream.
    const recognizeStream = speechToText.recognizeUsingWebSocket(params);

    // Pipe in the audio.
    fs.createReadStream(`audio/${file}`).pipe(recognizeStream);

    // Listen for events.
    recognizeStream.on('data', function(event) { onEvent('Data', event, file); saveData(file, event); });
    recognizeStream.on('error', function(event) { onEvent('Error', event, file); });
    recognizeStream.on('close', function(event) { onEvent('Close', event, file); });
  });
});

// Display events on the console.
function onEvent(name, event, file) {
  // console.log(name, JSON.stringify(event, null, 2));

  if (name === 'Error') {
    console.error(name, file);
  } else {
    console.log(name, file);
  }
};

function saveData(file, event) {
  let transcription = [];

  event.results.forEach(result => {
    result.alternatives.forEach(alternative => {
      if (alternative.timestamps && alternative.timestamps.length)
        transcription = transcription.concat(alternative.timestamps.map(time => ({
          word: time[0],
          start: time[1],
          end: time[2],
        })));
    });
  });

  const newTranscription = new Transcription({
    file,
    transcription
  });

  newTranscription.save();
}