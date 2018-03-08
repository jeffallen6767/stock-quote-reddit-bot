require('dotenv').config();

const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');

const stocks = require('./src/stocks');

// Build Snoowrap and Snoostorm clients
const r = new Snoowrap({
    userAgent: 'script:STOCK-TICKER-BOT:1.0.0 (by /u/STOCK-TICKER-BOT)',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});
const client = new Snoostorm(r);

// Configure options for stream: subreddit & results per query
const streamOpts = {
    subreddit: 'all',
    results: 25
};

if (process.argv.length > 3 && process.argv[2] == "test") {
  var
    comment = require(process.argv[3]);
  stocks.handleComment(comment);
} else {

  // Create a Snoostorm CommentStream with the specified options
  const comments = client.CommentStream(streamOpts);

  // On comment, perform whatever logic you want to do
  comments.on('comment', stocks.handleComment);
  
}
