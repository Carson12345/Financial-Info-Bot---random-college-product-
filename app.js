//load needed modules
var connect = require('connect');
var http = require('http');
var net = require('net');
var app = connect();
// require request-ip and register it as middleware
var requestIp = require('request-ip');
var builder = require('botbuilder');
var restify = require('restify');
var Store = require('./store');
var spellService = require('./spell-service');
var mssql = require('mssql');
var updatecount = 0;
var users = require('./users');
var plans = require('./plans');
const imageService = require('./image-service'),
    request = require('request').defaults({ encoding: null }),
    url = require('url'),
    validUrl = require('valid-url');

var fs = require('fs');
var bodyParser = require('body-parser');
var ejs = require('ejs');
var path = require('path');
var math = require('mathjs');
const restifyBodyParser = require('restify-plugins').bodyParser;



// This loads the environment variables from the .env file
require('dotenv-extended').load();



// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: "561fc406-6389-4d62-83f8-5635d0a53e37",
    appPassword: "dkSH0iAhaZ7z5tOxEQeFWo5"
});





var bot = new builder.UniversalBot(connector);
server.use(restifyBodyParser());
server.post('/api/messages', connector.listen());

// Maximum number of hero cards to be returned in the carousel. If this number is greater than 10, skype throws an exception.
const MAX_CARD_COUNT = 10;

const textapikey = "ce6e99c7adf64cd196462ffb0646cd09";


// You can provide your own model by specifing the 'LUIS_MODEL_URL' environment variable
// This Url can be obtained by uploading or creating your model from the LUIS portal: https://www.luis.ai/


const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/53ee32e2-9ccb-487f-9aec-fea03a61dc64?subscription-key=46903b96fcad4ae081d17a710e8f6113&verbose=true&timezoneOffset=0&q=';


// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);


//Sends greeting message when the bot is first added to a conversation
bot.on('conversationUpdate', message => {
    if (message.membersAdded) {
        message.membersAdded.forEach(identity => {
            if (identity.id === message.address.bot.id) {
                const reply = new builder.Message()
                    .address(message.address)
                    .text('Welcome back! How can I help you?');
                    
                bot.send(reply);
                console.log(message.address);
                console.log("The userid is: " + message.address.user.id);
                

                
            }
        });
    }
});

//handle
bot.dialog('/', new builder.IntentDialog({ recognizers: [recognizer] })
//Greetings
    .matches('greetings', [
        function (session, args, next) {
            console.log(session.message.text);
                var cards = greetingcard(session);
                // attach the card to the reply message
                var reply = new builder.Message(session)
                    .text('Hi! How can I help you?')
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);
                session.send(reply);


  }
    ])

//Get Definition
    .matches('search', [
        function (session, args, next) 
        
                        {
                        var company_name_ID = builder.EntityRecognizer.findEntity(args.entities, 'company');
                        var learner_des = company_name_ID;
                        learner_des_ID = learner_des.entity;
                        console.log("yes!! " + learner_des_ID);
                        request({   
                            url: "http://d.yimg.com/autoc.finance.yahoo.com/autoc?query="+company_name_ID.entity+"&region=1&lang=en",
                            method: "GET",
                        }, 
                        function(err, resp, body) {
                            console.log("success");
                            var decoded_data = body.toString('binary');
                            console.log(decoded_data);
                            var info_stock = JSON.parse(decoded_data)

                            try 
                                {
                                console.log(info_stock.ResultSet.Result[0].symbol);
                                var stock_name = info_stock.ResultSet.Result[0].name;
                                var ticker = info_stock.ResultSet.Result[0].symbol;
                                var exc_code = info_stock.ResultSet.Result[0].exchDisp;
                                var pic = "https://logo.clearbit.com/" + company_name_ID.entity +".com?size=800";
                                var cards = stockcard(session,stock_name,pic,ticker,exc_code);
                                // attach the card to the reply message
                                var reply = new builder.Message(session)
                                    .text('I think you are looking for this company. ')
                                    .attachmentLayout(builder.AttachmentLayout.carousel)
                                    .attachments(cards);
                                session.send(reply);

                                } 
                            catch(error) 
                                {
                                session.send('Sorry, maybe check the spelling of the company?', session.message.text);

                                }
                            })
                    
                            builder.Prompts.text(session, 'loading...');


                        }, function (session, results, next) {
                            var company_name = learner_des_ID;
                            var purpose = results.response;
                            console.log(purpose);
                            var myJSONObject = {
                                "date":{"from": getDate()-7,"to": getDate()},
                                //"date":{"from": startperiod, "to": endperiod},
                                "restrictedDateRange": "false",
                                "text": learner_des_ID
                            };

                
                            request({   
                                    url: "https://discovery-news-demo.mybluemix.net/api/query",
                                    method: "POST",
                                    headers: {
                                        "content-type": "application/json",
                                    },
                                    json: true,   // <--Very important!!!
                                    body: myJSONObject
                                }, 
                                function(err, resp, body) {
                                    
                                    console.log(body.aggregations[2].results[0].key);
                                    console.log("higher " + body.aggregations[4].results[0].matching_results);
                                    console.log("lower " + body.aggregations[4].results[1].matching_results);
                                    console.log("Neutral " + body.aggregations[4].results[2].matching_results);
                                    var higher = body.aggregations[4].results[0].matching_results;
                                    var lower = body.aggregations[4].results[1].matching_results;
                                    var neutral = body.aggregations[4].results[2].matching_results;
                                    var total = higher + lower + neutral;
                                    var neupert = math.round(neutral/total*100).toFixed(2);
                                    var higherpert = math.round(higher/total*100).toFixed(2);
                                    var lowerpert = math.round(lower/total*100).toFixed(2);
                                    console.log("higher Sentiment Percentage is " + higherpert + "%");
                                    console.log("lower Sentiment Percentage is " + lowerpert + "%");
                                    console.log(purpose);
                                    switch (purpose) {
                                    case "1":
                                            // //hot stories
                                            console.log(body.results[2]);
                                            var cards = new Array();
                                            for (var l = 0; l < body.results.length; l++) {
                                                cards.push(news_card(body.results[l].title,body.results[l].url,body.results[l].host));
                                            }
                                            const reply = new builder.Message()
                                                                        .address(session.message.address)
                                                                        .text('These are some sources that make up the ' + body.aggregations[4].results[0].key + ' sentiment towards ' + learner_des_ID)
                                                                        .attachmentLayout(builder.AttachmentLayout.carousel)
                                                                        .attachments(cards);
                                            bot.send(reply);
                                            session.send('Hope the info helps! Ask me about another company!', session.message.text);
                                        break;
                                    case "2":
                                            //hot companies
                                            console.log(body.aggregations[0]);
                                            console.log(body.aggregations[0].aggregations[0].aggregations[0].results.key);
                                            var cards2 = new Array();
                                            for (var l = 0; l < body.aggregations[0].aggregations[0].aggregations[0].results.length; l++) {
                                                cards2.push(entities_card(body.aggregations[0].aggregations[0].aggregations[0].results[l].key,body.aggregations[0].aggregations[0].aggregations[0].results[l].matching_results));
                                            }
                                            const reply2 = new builder.Message()
                                                                        .address(session.message.address)
                                                                        .text('These are the other companies people mention when talking about ' + learner_des_ID)
                                                                        .attachmentLayout(builder.AttachmentLayout.carousel)
                                                                        .attachments(cards2);
                                            bot.send(reply2);
                                            session.send('Hope the info helps! Ask me about another company!', session.message.text);
                                        break;
                                    case "3":
                                            // //hot topic

                                            var cards3 = new Array();
                                            for (var l = 0; l < body.aggregations[2].results.length; l++) {
                                                cards3.push(entities_card(body.aggregations[2].results[l].key,body.aggregations[2].results[l].matching_results));
                                            }
                                            const reply3 = new builder.Message()
                                                                        .address(session.message.address)
                                                                        .text('These are the topic people concern about ' + learner_des_ID)
                                                                        .attachmentLayout(builder.AttachmentLayout.carousel)
                                                                        .attachments(cards3);
                                            bot.send(reply3);
                                            session.send('Hope the info helps! Ask me about another company!', session.message.text);
                                            
                                        break;

                                    case "4":
                                    if ((body.aggregations[4].results[0].key == "positive") && higherpert > 50) {
                                        session.send('We in total conducted sentiment analysis on ' + body.matching_results + ' sources online, we will say ' + learner_des_ID + ' is doing quite well! '+ higherpert + "% of the internet comments are positive! While "+lowerpert+"% of those are negative"), session.message.text;
                                    } else if ((body.aggregations[4].results[0].key == "negative") && higherpert > 50) {
                                        session.send('We in total conducted sentiment analysis on ' + body.matching_results + ' sources online, we will say ' + learner_des_ID + ' is not doing really well. '+ higherpert + "% of the internet comments are negative! While "+lowerpert+"% of those are negative"), session.message.text;
                                    } else {
                                        session.send('We in total conducted sentiment analysis on ' + body.matching_results + ' sources online, we will say the market sentiment towards' +learner_des_ID + ' is quite neutral. '+ neupert + "% of the internet comments are negative! WHile"+lowerpert+"% of those are positive"), session.message.text;
                                    }
                                        session.send('Hope the info helps! Ask me about another company!', session.message.text);
                                    }
                                

                        

                            });
                        
  

                        }
                        
    ])





    .onDefault(
        
        (session) => {
        try {
            console.log(session.message.attachments[0]['contentUrl']);
            session.send('Your file has been hosted temporalily! Please use the following url', session.message.text);
            session.send(session.message.attachments[0]['contentUrl'], session.message.text);
            
        }
        catch(error) {
                var cards = greetingcard(session);
                // attach the card to the reply message
                var reply = new builder.Message(session)
                    .text('I understand but so far I can only provide the following functions. How can I help you?😉')
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);
                session.send(reply);
        }

    })
);

if (process.env.IS_SPELL_CORRECTION_ENABLED === 'true') {
    bot.use({
        botbuilder: function (session, next) {
            spellService
                .getCorrectedText(session.message.text)
                .then(text => {
                    session.message.text = text;
                    next();
                })
                .catch((error) => {
                    console.error(error);
                    next();
                });
        }
    });
}





//download picture

var downloadpic = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};



//
const arrayColumn = (arr, n) => arr.map(x => x[n]);

//wikians
function constructwikiCard(page) {
                        return new builder.HeroCard()
                            .title(page.title)
                            .subtitle(page.extract.substr(0, 600).trim()+'...')
                            .buttons([
                                new builder.CardAction()
                                    .title('More about this definition')
                                    .type('openUrl')
                                    .value("https://en.wikipedia.org/?curid=" + page.pageid)
                            ]);
                    }



                    
//return company name
function callback_comp_name(compname) {
    return compname;
}


//Stock quote
function stockcard(session,name,pic,ticker,exc) {
    return [ 
        new builder.HeroCard(session)
        .images([
            builder.CardImage.create(session, pic)
        ])

,

        new builder.HeroCard(session)
        .title( name  + " (" + ticker +")")
        .subtitle("Exchange: " + exc)

        .text("Please choose from the following options for more detailed analysis")
        .buttons([
            builder.CardAction.openUrl(session, 'http://www.cnbc.com/quotes/?symbol=' + ticker, 'Stock Performance'),
            builder.CardAction.postBack(session, '1', 'See supporting news articles'),
            builder.CardAction.postBack(session, '2', 'See trending most mentioned topics'),
            builder.CardAction.postBack(session, '3', 'See co-mentioned companies'),
            builder.CardAction.postBack(session, '4', 'Show Market Sentiment statistics')
    
        ])
        
    ]
}



//Newscard
function news_card(title,url,media) {
    return new builder.HeroCard()
        .title(title)
        .subtitle("Source: "+media)
        .buttons([
            new builder.CardAction.openUrl()
                                    .title('Read this source')
                                    .value(url)
        ]);
}

//Newscard
function entities_card(title,url,media) {
    return new builder.ThumbnailCard()
        .title(title)
        .subtitle("Matching Results: "+ media)
}


function getDate() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + month + day;

}




//find interaction of Array
function intersect_arr(a, b)
{
  var ai=0, bi=0;
  var result = [];

  while( ai < a.length && bi < b.length )
  {
     if      (a[ai] < b[bi] ){ ai++; }
     else if (a[ai] > b[bi] ){ bi++; }
     else /* they're equal */
     {
       result.push(a[ai]);
       ai++;
       bi++;
     }
  }

  return result;
}





//pplcard
function pplcard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('Net change in account balance: $2325.7 ')
        .subtitle('You saved $2325.7 this month!')
        .text('Congrats! You met the saving target for this month and saved $2325.7! Click the following button to see the growth history and the projected growth trend!')
        .images([
            builder.CardImage.create(session, 'https://s11.postimg.org/ofc1bi7o3/goal-01.png')
        ])
        .buttons([
            builder.CardAction.imBack(session, 'See wealth growth', 'See wealth growth')
    
        ])
        ,

        new builder.HeroCard(session)
        .title('Your Total Expenditure this month: ')
        .subtitle('This report is based on the data collectedfrom 22/5 - 26/5')
        .text('Click "Expenditure breakdown" to see what did you spend your money on this month!')
        .images([
            builder.CardImage.create(session, 'https://s4.postimg.org/tidfqpfy5/pay-01.png')
        ])
        // .buttons([
        //     builder.CardAction.openUrl(session, 'http://www.ifva.com/?p=7620&lang=en', 'Apply Now')
        // ])
        .buttons([
            builder.CardAction.imBack(session, 'Advice on reducing expenditure', 'Advice on reducing expenditure')
    
        ])
        ,

        new builder.HeroCard(session)
        .title('Your Total Income this month: ')
        .subtitle('This report is based on the data collectedfrom 22/5 - 26/5')
        .text('Click "Income breakdown" to see what did you spend your money on this month!')
        .buttons([
            builder.CardAction.imBack(session, 'Advice on expanding income sources', 'Advice on expanding income sources')
    
        ])
        .images([
            builder.CardImage.create(session, 'https://s29.postimg.org/6s0r7rd6v/save-01.png')
        ])
        // .buttons([
        //     builder.CardAction.openUrl(session, 'http://www.ifva.com/?p=7620&lang=en', 'Apply Now')
        // ])
    ]
}

//cant save card
function cantcard(session) {
    return [ 
        new builder.ThumbnailCard(session)
        .title('Net change in account balance: ')
        .subtitle('Your account loses $500 this month!')
        .text('I found out that you are having rather high expenditure this month! I would suggest you to check out the wealth management from HKMA. If you need to borrow money for emergency, please click out the loans info below')
        // // .images([
        // //     builder.CardImage.create(session, 'https://ga-shop-production-herokuapp-com.global.ssl.fastly.net/assets/images/logo_1200_by_627_1QIVL.jpg')
        // // ])
        .buttons([
            builder.CardAction.imBack(session, 'See wealth growth', 'See wealth growth')
        ,
            builder.CardAction.openUrl(session, './chart.html', 'Saving Advice from HKMA')
        ,
            builder.CardAction.openUrl(session, 'https://bank.hangseng.com/1/2/chi/personal/loans/instalment-loan?&cid=personal-loans:ploan2017:sem:googlesem:runofsite&mkwid=soZGazmvZ_187333725767_%252Bhang%2520%252Bseng%2520%252Bloan_b_c', 'Hang Seng Personal Loan/Credit Card Loan')
        ])
        ,

        new builder.HeroCard(session)
        .title('Your Total Expenditure this month: ')
        .subtitle('This report is based on the data collectedfrom 22/5 - 26/5')
        .text('Click "Expenditure breakdown" to see what did you spend your money on this month!')
        // .images([
        //     builder.CardImage.create(session, 'https://camo.githubusercontent.com/22c2fafa60804cb2bc3f60ff8afe6d5262da3b25/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f7a654d6972636f2f6769746875622f73776966742d6c696e6563686172742f30312e706e67')
        // ])
        // .buttons([
        //     builder.CardAction.openUrl(session, 'http://www.ifva.com/?p=7620&lang=en', 'Apply Now')
        // ])
        .buttons([
            builder.CardAction.imBack(session, 'Advice on reducing expenditure', 'Advice on reducing expenditure')
    
        ])
        ,

        new builder.HeroCard(session)
        .title('Your Total Income this month: ')
        .subtitle('This report is based on the data collectedfrom 22/5 - 26/5')
        .text('Click "Income breakdown" to see what did you spend your money on this month!')
        .buttons([
            builder.CardAction.imBack(session, 'Advice on expanding income sources', 'Advice on expanding income sources')
    
        ])

    ]
}

//greeting cards
function greetingcard(session) {
    return [
        new builder.HeroCard(session)
        .title('Real Time Market Sentiment Analysis 💡 ')
        .subtitle('Try to ask me questions like: How is Apple/How is AAPL?')
        // .images([
        //     builder.CardImage.create(session, 'https://s13.postimg.org/4dpbpu87r/icons_proj3-01.jpg')
        // ])
        .buttons([
            builder.CardAction.imBack(session, 'How is Apple', 'How is XXX?')
    
        ])
        ,

        new builder.HeroCard(session)
        .title('Check out my linkedin profile 📊 ')
        .subtitle('Hope you would like my past experience and skills')
        // .images([
        //     builder.CardImage.create(session, 'https://s16.postimg.org/sunkeafhx/icons_findppl-01.jpg')
        // ])
        .buttons([
            builder.CardAction.openUrl(session, 'https://www.linkedin.com/in/carson-yau-ming-yiu-57495b100/', 'My Linkedin')
        
        ]),

        new builder.HeroCard(session)
        .title('Check out my github')
        .subtitle('See the source code and my other projects on my Github')
        // .images([
        //     builder.CardImage.create(session, 'https://s16.postimg.org/sunkeafhx/icons_findppl-01.jpg')
        // ])
        .buttons([
            builder.CardAction.openUrl(session, 'https://github.com/Carson12345', 'My Github')
        
        ])
        


    ]
}
//opportunities update

function eventcard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('Predicted Month-end Net Balance: +$570 ')
        .subtitle('The latest estimate of net change in your bank balance at the end of this month')
        .text('Hi there! The predicted net change is +$570, which is lower than your saving target! you better spend less in the rest of the days this month!')
        .images([
            builder.CardImage.create(session, 'https://s29.postimg.org/cmv6gldl3/trend-01.png')
        ])
        .buttons([
            builder.CardAction.imBack(session, 'Show me the prediction graph', 'See prediction graph')
    
        ])
        ,

        new builder.HeroCard(session)
        .title('Your Expense this week: $930 ')
        .subtitle('This report is based on the data collectedfrom 22/5 - 26/5')
        .text('Week-over-Week Expense growth: +3.21% ')
        .images([
            builder.CardImage.create(session, 'https://s4.postimg.org/tidfqpfy5/pay-01.png')
        ])

        .buttons([
            builder.CardAction.imBack(session, 'Show me the expense graph', 'See graph')
    
        ])
        ,

        new builder.HeroCard(session)
        .title('Your Income this week: $50')
        .subtitle('This report is based on the data collectedfrom 22/5 - 26/5')
        .text('Week-over-Week Income growth: -0.37%')
        .buttons([
            builder.CardAction.imBack(session, 'Show me the income graph', 'See graph')
    
        ])
        .images([
            builder.CardImage.create(session, 'https://s29.postimg.org/6s0r7rd6v/save-01.png')
        ])

    ]
}


//investment update

function investcard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('The amount of money that can be used to invest')
        .subtitle('We analysed your expenditure pattern')
        .text('We analysed your expenditure pattern, we found out that actually you have around $10,000 unused funds in your account. If you would like to explore available investment options, please click to start a risk assessment.')
        .buttons([
            builder.CardAction.imBack(session, 'Start Risk Assessment', 'Start Risk Assessment')
        ])

    ]
}

//investment options

function optioncard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('Stock')
        .subtitle('Stock Investment is suitable for people with score > X in the risk assessment')
        .text('Stock Investment is suitable for people with score > X in the risk assessment')
        .buttons([
            builder.CardAction.imBack(session, 'Place order - Stocks', 'Place order')
        ]),


        new builder.HeroCard(session)
        .title('Bond')
        .subtitle('Bond Investment is suitable for people with score > X in the risk assessment')
        .text('Bond Investment is suitable for people with score > X in the risk assessment')
        .buttons([
            builder.CardAction.imBack(session, 'Place order - Bonds', 'Place order')
        ]),

        new builder.HeroCard(session)
        .title('Time Deposit')
        .subtitle('Time Deposit Investment is suitable for people with score > X in the risk assessment')
        .text('Time Deposit Investment is suitable for people with score > X in the risk assessment')
        .buttons([
            builder.CardAction.imBack(session, 'Place order - Time Deposits', 'Place order')
        ])

        ,
        new builder.HeroCard(session)
        .title('Funds')
        .subtitle('Funds Investment is suitable for people with score > X in the risk assessment')
        .text('Funds Investment is suitable for people with score > X in the risk assessment')
        .buttons([
            builder.CardAction.imBack(session, 'Place order - Funds', 'Place order')
        ])

    ]
}

//expenditure update

function savingcard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('Wealth growth trend')
        .subtitle('You did a great job!')
        .text('Above is how much your wealth have growth in the past one year')
    
        // // .images([
        // //     builder.CardImage.create(session, 'https://ga-shop-production-herokuapp-com.global.ssl.fastly.net/assets/images/logo_1200_by_627_1QIVL.jpg')
        // // ])
    ]
}
//expenditure update

function breakcard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('Expenditure Breakdown')
        .subtitle('Above is how much you have spent in each category')
        .text('Below how much you have spent in each category')
        .images([
            builder.CardImage.create(session, 'https://s12.postimg.org/hsk8ackgt/piechart.png')
        ])
    ]
}

//income update

function incomecard(session) {
    return [ 
        new builder.HeroCard(session)
        .title('Income Breakdown')
        .subtitle('You can spend some of your money in the account on investment')
        .text('I have identified that there are around $10,000 unused funds. If you want to expand our income sources, I can give you information of the available options!')
        .buttons([
            builder.CardAction.imBack(session, 'How can I increase income streams?', 'How can I increase income streams?')
        ])
        .images([
            builder.CardImage.create(session, 'https://s16.postimg.org/3lv8taixh/Untitled-3-01.png')
        ])
    ]
}






