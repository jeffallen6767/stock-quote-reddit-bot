// stocks.js
var
  request = require('request'),
  moment = require('moment'),
  ASCII_COMMA = ',',
  ASCII_SPACE = ' ',
  ASCII_PERIOD = '.',
  ASCII_DOLLAR_SIGN = '$',
  ASCII_PERCENT = '%',
  ASCII_HYPHEN = '-',
  ASCII_AT_SYMBOL = '@',
  EMPTY_STRING = '',
  NEW_LINE = "\r\n",
  DOUBLE_LINE_BREAK = "\n\n",
  REDDIT_HORIZONTAL_LINE = "*****",
  REDDIT_NEW_LINE = [
    ASCII_SPACE, ASCII_SPACE, NEW_LINE, NEW_LINE
  ].join(EMPTY_STRING),
  DOUBLE_ASTERISK = '**',
  REDDIT_DIVIDER = [
    REDDIT_NEW_LINE, REDDIT_NEW_LINE
  ].join(REDDIT_HORIZONTAL_LINE),
  F_BOLD = function(val) {
    return [
      DOUBLE_ASTERISK,
      DOUBLE_ASTERISK
    ].join(val);
  },
  FORMATS = {
    "bold": F_BOLD
  },
  GITHUB_LINK = 'https://github.com/jeffallen6767/stock-quote-reddit-bot',
  REDDIT_SIGNATURE = [
    [
      "I'm a [bot](" + GITHUB_LINK + ") ",
      " I respond to " + F_BOLD("$STOCK_TICKER") + " in reddit comments ",
      " Please don't abuse me. ",
    ].join(ASCII_HYPHEN + ASCII_HYPHEN),
    [
      "Comments/Suggestions/Problems? Please message my [creator](https://www.reddit.com/user/STOCK-TICKER-BOT)",
      " Thanks!!!"
    ].join(ASCII_HYPHEN + ASCII_HYPHEN)
  ].join(REDDIT_NEW_LINE),
  SYMBOL_PLACEHOLDER = '[[SYMBOLS]]',
  QUOTE_URL = [
    'https://api.iextrading.com/1.0/stock/market/batch?symbols=',
    '&types=quote'
  ].join(SYMBOL_PLACEHOLDER),
  SYMBOL_MATCHER = /\$[A-Za-z\.]+/gi,
  RETRY_MATCHER = /try again in (d+) seconds/gi,
  //        "Sunday, February 14th 2010, 3:25:50 pm"
  DATE_TIME_FORMAT = 'dddd, MMMM Do YYYY, h:mm:ss a',
  T_TIME = function(val) {
    return moment(val).format(DATE_TIME_FORMAT);
  },
  T_MONEY = function(val) {
    console.log("T_MONEY", val);
    var
      strDec = val.toFixed(2).toString(),
      parts = strDec.split('.'),
      dollars = parts[0],
      cents = parts[1],
      result = [
        ASCII_DOLLAR_SIGN, 
        ASCII_SPACE, 
        T_BIGNUM(dollars),
        ASCII_PERIOD,
        cents
      ].join(EMPTY_STRING);
    console.log("==>", result);
    return result;
  },
  T_BIGNUM = function(val) {
    console.log("T_BIGNUM", val);
    var
      digits = (val + '').split(EMPTY_STRING),
      num = 0,
      tmp = [],
      result;
    while(digits.length) {
      if (++num > 3) {
        tmp.unshift(ASCII_COMMA);
        num = 1;
      }
      tmp.unshift(
        digits.pop()
      );
    }
    result = tmp.join(EMPTY_STRING);
    console.log("==>", result);
    return result;
  },
  T_PERCENT = function(val) {
    console.log("T_PERCENT", val);
    var
      result = [
        (val * 100).toFixed(2),
        ASCII_PERCENT
      ].join(ASCII_SPACE);
    console.log("==>", result);
    return result;
  },
  TRANSLATIONS = {
    "open": T_MONEY,
    "openTime": T_TIME,
    "close": T_MONEY,
    "closeTime": T_TIME,
    "high": T_MONEY,
    "low": T_MONEY,
    "latestPrice": T_MONEY,
    "latestUpdate": T_TIME,
    "change": T_MONEY,
    "iexBidPrice": T_MONEY,
    "iexAskPrice": T_MONEY,
    "iexLastUpdated": T_TIME,
    "week52High": T_MONEY,
    "week52Low": T_MONEY,
    "latestVolume": T_BIGNUM,
    "marketCap": T_BIGNUM,
    "changePercent": T_PERCENT,
    "ytdChange": T_PERCENT
  },
  line = function() {
    return [].slice.call(arguments).join(ASCII_SPACE);
  },
  formatPost = function(d) {
    console.log(d);
    var
      f = FORMATS,
      bold = f.bold,
      lines = [
        line(bold(d.symbol), ASCII_HYPHEN, bold(d.companyName), ASCII_AT_SYMBOL, bold(d.primaryExchange)),
        line("Latest", d.latestPrice, "Volume:", d.latestVolume, "Bid", d.iexBidPrice + "/" + d.iexBidSize, "Ask", d.iexAskPrice + "/" + d.iexAskSize),
        line("High", d.high, "Low", d.low),
        line("Open", d.open, ASCII_AT_SYMBOL, d.openTime),
        line("Close", d.close, ASCII_AT_SYMBOL, d.closeTime),
        line("Previous Close", d.previousClose, "Change", d.change, "Change Percentage", d.changePercent),
        line("Market Cap $", d.marketCap, "Shares Outstanding", T_BIGNUM(Math.floor(d._marketCap / d._latestPrice))),
        
        /* TODO: add some other stats when we have more time */
        
      ],
      result = lines.join(REDDIT_NEW_LINE);
    
    return result;
  },
  translate = function(data) {
    return Object.keys(data).reduce(function(obj, key) {
      var
        value = data[key],
        translationFunction = TRANSLATIONS[key];
      if (translationFunction) {
        obj[key] = translationFunction(value);
        obj["_"+key] = value;
      } else {
        obj[key] = value;
      }
      return obj;
    }, {});
  },
  parseAndReply = function(comment, quote) {
    try {
      var data = JSON.parse(quote);
      replyToComment(comment, data);
    } catch (e) {
      console.error("parseAndReply", e.getMessage());
    }
  },
  replyToComment = function(comment, data) {
    console.log("replyToComment");
    var
      quotes = Object.keys(data).map(function(key) {
        return data[key].quote;
      }),
      translated = quotes.map(translate),
      formatted = translated.map(formatPost),
      replyText = formatted.join(REDDIT_DIVIDER),
      replyPost = [
        replyText, REDDIT_SIGNATURE
      ].join(REDDIT_DIVIDER),
      msg, rate;
    
    if (typeof comment.reply === 'function') {
      try {
        comment.reply(replyPost);
      } catch (e) {
        msg = e.getMessage();
        console.error("caught reply error", msg, e);
        if (msg.indexOf("RATELIMIT") > -1) {
          rate = msg.match(RETRY_MATCHER);
          console.log("NEW RATE", rate, msg);
        }
      }
      console.log(replyPost);
    } else {
      console.log("data", data);
      console.log("quotes", quotes);
      console.log("translated", translated);
      console.log("formatted", formatted);
      console.log("replyPost", replyPost);
    }
  },
  getSymbolQuote = function(comment) {
    console.log("BOT will handle: ", comment.body);
    var
      body = comment.body,
      matches = body.match(SYMBOL_MATCHER),
      symbols = matches.reduce(function(acc, symbol) {
        acc.push(
          symbol.replace(ASCII_DOLLAR_SIGN, EMPTY_STRING)
        );
        return acc;
      }, []).join(ASCII_COMMA),
      url = QUOTE_URL.replace(SYMBOL_PLACEHOLDER, symbols),
      callback = function(error, response, body) {
        if (error) {
          console.error(comment, symbols, url, error);
        } else if (response.statusCode !== 200) {
          console.warn(comment, symbols, url, response.statusCode, body);
        } else {
          // good response ( aka 200 )
          console.log(url);
          console.log(body);
          if (body === "{}") {
            // bad symbol? or some other quote problem...
            console.error("getSymbolQuote no quote for ", url);
          } else {
            parseAndReply(comment, body);
          }
        }
      },
      get = request(url, callback);
    console.log("body", body);
    console.log("matches", matches);
    console.log("symbols", symbols);
  },
  handleComment = function(comment) {
    console.log(comment.body);
    // fast test
    if (SYMBOL_MATCHER.test(comment.body)) {
      getSymbolQuote(comment);
    }
  },
  api = {
    "handleComment": handleComment
  };

module.exports = api;
