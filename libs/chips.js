const WS = require('ws')
const Client = require('@chipsgg/ws-api-client')
const { Store } = require('ynk')
const number_format = require("number_format-php");
const axios = require('axios');

var store;
var wsclient;

module.exports = {
    setBeta: function(isbeta){
        if(isbeta) this.socketURL = 'wss://staging.chips.gg';
        else this.socketURL = 'wss://api.chips.gg/prod/socket';
    },

    getCommands: function(commandlist){
        var commandlist = {}

        commandlist.divs = {}
        commandlist.divs.description = 'Get the value of The Vault.';
        commandlist.divs.function = 'getDivs(ctx,ARG,Extra);';

        commandlist.events = {}
        commandlist.events.description = 'Get the latest events';
        commandlist.events.function = 'getEvents(ctx,Extra);';

        commandlist.prices = {}
        commandlist.prices.description = 'Get current price of currencies';
        commandlist.prices.function = 'getPrices(ctx);';

        commandlist.top = {}
        commandlist.top.description = 'Show current Top 10 of every event.';
        commandlist.top.function = 'getTops(ctx);';

        commandlist.groups = {}
        commandlist.groups.description = 'Show list of CHIPS groups';
        commandlist.groups.function = 'getGroups(ctx)';

        return commandlist;
    },
    getGroups: async function(ctx){
        var message="MrChips has Ambassadors that speak the following Languages:\n\n";

        message+="🇷🇺🇷🇺🇷🇺 @Chips_Russian (русский)\n";
        message+="🇨🇳🇨🇳🇨🇳 @Chips_Chinese (汉语)\n";
        message+="🇫🇷🇫🇷🇫🇷 @Chips_French (Français)\n";
        message+="🇪🇸🇪🇸🇪🇸 @Chips_Spanish (Español)\n";
        message+="🇵🇹🇵🇹🇵🇹 @Chips_Portuguese (Português)\n";
        message+="🇳🇱🇳🇱🇳🇱 @Chips_Dutch (Nederlands)\n";
        message+="🇮🇹🇮🇹🇮🇹 @Chips_Italian (Italiano)\n";
        message+="🇩🇪🇩🇪🇩🇪 @Chips_German (Deutsch)\n";

        this.parent.sendMessage(ctx,message,'getgroups',false,false);
    },
    getPrices: async function (ctx) {

    
        var isBusy=false;

        const store = Store()
        const wsclient = await Client(
            WS,
            { channels: ['public'], host: this.socketURL, },
            (type, state) => {

            if (!isBusy && type == 'change') {
                isBusy=true;
                store.set({...state})

                var prices = store.get('public.prices');
                var currencies = store.get('public.currencies');

                const enabled = Object.keys(currencies)
                const assets = Object.keys(prices).filter(x => {
                    var cur='';
                    if(x.indexOf('BUSD')>0){
                        cur = x.split('BUSD');
                    }
                    else if(x.indexOf('USDT')>0){
                        cur = x.split('USDT');
                    }
                    else {
                        cur = x.split('USD');
                    }
                    const [currency] = cur;
                    return enabled.includes(currency.toLowerCase())
                })

                var message="<strong>Current prices:</strong>";
                for(a in assets){
                    var asset = assets[a];

                    var dec=2;
                    if(asset.toLowerCase()=='trxusdt') dec=5;
                    if(asset.toLowerCase()=='xrpusdt') dec=5;
                    if(asset.toLowerCase()=='wexusd') dec=5;

                    if(asset.indexOf('USDT')>0) message+="\n"+asset.replace('USDT','/USDT')+": $"+number_format(prices[asset],dec,'.',',');
                    else if(asset.indexOf('BUSD')>0) message+="\n"+asset.replace('BUSD','/BUSD')+": $"+number_format(prices[asset],dec,'.',',');
                    else if(asset.indexOf('USD')>0) message+="\n"+asset.replace('USD','/USD')+": $"+number_format(prices[asset],dec,'.',',');
                }

                this.parent.sendMessage(ctx,message,'getprices',false,false);
                wsclient.close();
            }
        });

    },
    getEvents: async function (ctx,Extra) {
        const chatId = ctx.update.message.chat.id;

    

        store = Store()
        wsclient = await Client(WS, { channels: ["public"], host: this.socketURL });
        wsclient.actions.public('listActiveRaces', { skip: 0, limit: 10}).then(async response => {
            message = "<strong>ONGOING EVENTS</strong>\n";
            var done=false;
            for(var r in response){
                event = response[r];
                var cd = this.showDate(event['endTime']);

                message += "---------\n<strong>" + event['title'] + "</strong>\n";
                message += "<strong>Ends:</strong> " + cd + "\n\n";
                message += "<em>" + event['subtitle'] + "</em>\n";
                done=true;
            }

            if(!done){
                message="There are no races at the moment!";
            }

            this.parent.sendMessage(ctx,message,'getevents',false,false);

            wsclient.close();
        });

    },
    showDate: function(date){
        var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear(),
        hours = d.getHours();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        if (hours == 2) hours = 0;
        if (hours == 14) hours = 12;
        if (hours < 10) hours = '0' + hours;

        var cd = [day, month, year].join('-') + " " + hours + ":00 UTC";
        return cd;
    },
    getTops: async function (ctx) {
        const chatId = ctx.update.message.chat.id;

        store = Store()
        wsclient = await Client(WS, { channels: ["public"], host: this.socketURL });

        wsclient.actions.public('listActiveRaces', { skip: 0, limit: 10}).then(async response => {

            message = "";

            for(var r in response){
                await this.getTop(response[r]);
            }

            this.parent.sendMessage(ctx,message,'gettops',false,false);
            wsclient.close();

        });


    },
    getTop: async function (event) {
        return new Promise( async (resolve, reject) => {

            wsclient.actions.public('listRaceRanks', {raceid: event['id']}).then(async ranks => {

                var cd = this.showDate(event['endTime']);

                message += "<strong>" + event['title'] + "</strong>\n";
                message+="<a href='https://chips.gg/event/"+event['id']+"'><strong>View event</strong></a>\n";
                message += "\n<strong>Current Top 10:</strong>\n";

                for (var r in ranks) {
                    var ranknum = (parseFloat(r) + 1);
                    if(ranknum<=10){
                        var name = "<a href='https://chips.gg/games/home?modal=PlayerProfile&userid="+ranks[r]['user']['id']+"'>"+ranks[r]['user']['username']+"</a>";

                        if(typeof(ranks[r]['multiplier'])!=='undefined' && ranks[r]['multiplier']!=='' && typeof(ranks[r]['bet'])!=='undefined' && ranks[r]['bet']!==null && typeof(ranks[r]['bet']['slotname'])!=='undefined' && ranks[r]['bet']['slotname']!==''){
                            message += "<strong>"+ranknum+".</strong> "+name+", <strong>"+ranks[r]['multiplier']+"x</strong> @ "+ranks[r]['bet']['slotname']+"\n";
                        }
                        else if(typeof(ranks[r]['wagered'])!=='undefined' && ranks[r]['wagered']>0){
                            message += "<strong>"+ranknum+".</strong> "+name+", $"+number_format(ranks[r]['wagered']/1000000,2,'.',',')+"\n";
                        }
                        else {
                            message += "<strong>"+ranknum+".</strong> "+name+", "+ranks[r]['score']+"\n";
                        }
                    }
                }

                message+="\n\n";
                resolve();
            });

        });
    },

    getDivs: async function (ctx,argument,Extra){
        //console.log('arg '+argument);
        //https://api.exchangeratesapi.io/latest?base=USD&symbols=EUR,GBP
        var curfunc=this;

        var currency = '';
        var currencySymbol='';
        if(argument.toLowerCase()=='eur' || argument.toLowerCase()=='euro' || argument.toLowerCase()=='eu'){
            currency='EUR';
            currencySymbol='€';
        }
        if(argument.toLowerCase()=='gbp'){
            currency='GBP';
            currencySymbol='£';
        }
        if(argument.toLowerCase()=='cad'){
            currency='CAD';
            currencySymbol='C$';
        }
        if(argument.toLowerCase()=='cny'){
            currency='CNY';
            currencySymbol='¥';
        }
        axios
        .get('https://api.exchangeratesapi.io/latest?base=USD&symbols=EUR,GBP,CNY,CAD')
        .then( async ({ data })=> {

            var isBusy=false;
            const chatId = ctx.update.message.chat.id;

            

            const store = Store()
            try {
                const wsclient = await Client(
                    WS,
                    { channels: ['public'], host: this.socketURL, },
                    (type, state) => {
                        if (!isBusy && type == 'change') {
                            isBusy=true;
                            store.set({ ...store.get(), ...state })

                            var total=0;
                            var curs = store.get('public.currencies');
                            var currencies = {};
                            var doSend=false;

                            var message = "<strong>Chips.gg Vault</strong>\n";

                            for(c in curs){
                                if(curs[c].name!=='chips' && curs[c].name!=='chips_staking'){
                                    currencies[curs[c].name] = (store.get('public.currencies.'+curs[c].name+'.profitshare')/Math.pow(10, curs[c].decimals));

                                    if(curs[c].name=='usdt') {
                                        doSend=true;
                                        if (currencies[curs[c].name] > 0) total += currencies[curs[c].name];
                                        message+=curs[c].name.toUpperCase()+": $"+number_format(currencies[curs[c].name],2,'.',',');
                                        if(currency!==''){
                                            message+=" ("+currencySymbol+number_format((currencies[curs[c].name]*data.rates[currency]),2,'.',',')+")";
                                        }
                                        message+="\n";

                                    }
                                    else if(typeof(curs[c].name) !=='undefined') {
                                        doSend=true;

                                        var basec='USDT';
                                        if(curs[c].name=='cake') basec='BUSD';
                                        if(curs[c].name=='banana') basec='USD';
                                        if(curs[c].name=='wex') basec='USD';

                                        currencies[curs[c].name + 'usdt'] = currencies[curs[c].name] * parseFloat(store.get('public.prices.' + curs[c].name.toUpperCase() + basec));
                                        if (currencies[curs[c].name + 'usdt'] > 0) total += currencies[curs[c].name + 'usdt'];

                                        var decimals = 2;
                                        if(curs[c].decimals>6) decimals=6
                                        message+=curs[c].name.toUpperCase()+": "+number_format(currencies[curs[c].name],decimals,'.',',')+" (";
                                        if(currency=='') message+="$"+number_format(currencies[curs[c].name + 'usdt'],2,'.',',');
                                        else {
                                            message+=currencySymbol+number_format((currencies[curs[c].name + 'usdt']*data.rates[currency]),2,'.',',');
                                        }
                                        message+=")\n";
                                    }
                                }
                            }

                            var staked = (store.get('public.profitShareInfo.totalStaked')/1000000);
                            var totalToDistribute = total/2;
                            var totalForHolders = totalToDistribute/2;

                            if(currency==''){
                                message+="\n<strong>Total value: $"+number_format(total,2,'.',',')+"</strong>\n";
                                message+="Distribution per 1000 CHIPS: $"+number_format(((totalForHolders/staked)*1000),6,'.',',')+"\n";
                            }
                            else {
                                message+="\n<strong>Total value: "+currencySymbol+number_format((total*data.rates[currency]),2,'.',',')+"</strong>\n";
                                message+="Distribution per 1000 CHIPS: "+currencySymbol+number_format((((totalForHolders/staked)*1000)*data.rates[currency]),6,'.',',')+"\n";
                            }

                            message+="Total CHIPS minted: "+number_format((store.get('public.profitShareInfo.totalMinted')/1000000),2,'.',',')+"\n";
                            message+="Total CHIPS locked: "+number_format(staked,2,'.',',')+"\n\n";

                            const today = new Date();
                            //today.setHours(today.getHours() - 1); // REMOVE FOR SUMMER TIME
                            const endDate = new Date(parseFloat(store.get('public.profitShareInfo.distributeAt')));

                            var days = parseInt((endDate - today) / (1000 * 60 * 60 * 24));
                            var hours = parseInt(Math.abs(endDate - today) / (1000 * 60 * 60) % 24);
                            var minutes = parseInt(Math.abs(endDate.getTime() - today.getTime()) / (1000 * 60) % 60);

                            message+="<strong>Next distribution in:</strong>\n"+hours+" hours and "+minutes+" minutes";

                            if(doSend){

                                var buttons = []

                                var visit = {}
                                visit.title='Click here to see your cut!';
                                visit.url = 'https://chips.gg/games/home/?modal=Vault&tab=the-vault';
                                buttons.push(visit);

                                this.parent.sendMessage(ctx,message,'getdivs',true,true,false,0,buttons);
                            }
                            else {
                                setTimeout(function(){
                                    curfunc.getDivs(ctx,argument,Extra);
                                },500);
                            }
                        }

                        wsclient.close();
                    }
                )
            }
            catch (error) {
                console.error(error);
            }

        });
    }
};