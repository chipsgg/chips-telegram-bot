const { Telegraf, Markup, Extra } = require("telegraf");
let lastMessages = {};

module.exports = {
  getCommandsDescription: async function (ctx, curmodule) {
    ctx.replyWithHTML(this.commandsDescription[curmodule]);
  },
  startModules: function (modules, isbeta) {
    var commandList = {};

    const bot = new Telegraf(this.apikey);

    var start = "<strong>" + this.startTitle + "</strong>\n";
    start += this.startMessage + "\n\n";

    this.mod = {};
    this.commandsDescription = {};
    for (m in modules) {
      var curmodule = modules[m];
      this.mod[curmodule] = require("./" + curmodule);
      this.mod[curmodule].parent = this;

      if (typeof this.mod[curmodule].setBeta !== "undefined") {
        if (typeof isbeta == "undefined") isbeta = false;
        this.mod[curmodule].setBeta(isbeta);
      }

      moduleCommands = this.mod[curmodule].getCommands();
      commandList[curmodule] = {};
      for (command in moduleCommands) {
        commandList[curmodule][command] = moduleCommands[command];
        commandList[curmodule][command]["function"] =
          "mod['" +
          curmodule +
          "']." +
          commandList[curmodule][command]["function"];
      }
    }

    var mods = this.mod;
    var commandFunctions = {};
    for (m in commandList) {
      for (c in commandList[m]) {
        if (
          typeof commandList[m][c].hide == "undefined" ||
          commandList[m][c].hide === false
        ) {
          if (typeof commandList[m][c].argument !== "undefined")
            start += "/" + c + " " + commandList[m][c].argument + "\n";
          else start += "/" + c + "\n";
          start += commandList[m][c].description + "\n\n";
        }

        commandFunctions[c] = commandList[m][c].function;
        bot.command([c, c + "@" + this.username], async (ctx) => {
          var command = ctx.message.text.replace(/ /, "&").split("&"); // to split only on first space, replace by other character and split from there
          var arg = "";
          if (typeof command[1] !== "undefined") {
            arg = command[1];
            arg = arg.split("\n");
            arg = arg[0];
          }
          command = command[0].split("@");
          command = command[0].replace("/", "");

          if (typeof commandFunctions[command] !== "undefined")
            eval(
              "this." +
                commandFunctions[command].replace("ARG", '"' + arg + '"')
            );
        });
      }
    }

    bot.command(
      ["start", "start@" + this.username, "help", "help@" + this.username],
      async (ctx) => {
        var mes = ctx.replyWithHTML(start);
      }
    );

    bot.on("new_chat_members", async (ctx) => {
      if (
        typeof this.groupWelcome !== "undefined" &&
        this.groupWelcome !== ""
      ) {
        for (m in ctx.update.message.new_chat_members) {
          var member = ctx.update.message.new_chat_members[m];
          var welcome = this.groupWelcome.replace(
            "[USERNAME]",
            member.first_name
          );
          var mes = ctx.replyWithHTML(welcome, Extra.webPreview(false));
        }
      }
    });

    bot.startPolling();
  },
  sendMessage: async function (
    ctx,
    message,
    type,
    deleteprevious,
    deletecommand,
    showpreview,
    replyto,
    buttons,
    image,
    video
  ) {
    if (typeof replyto == "undefined") replyto = 0;
    if (typeof showpreview == "undefined") showpreview = false;
    if (typeof buttons == "undefined") buttons = [];
    if (typeof image == "undefined") image = "";
    if (typeof video == "undefined") video = "";

    const chatId = ctx.update.message.chat.id;

    if (typeof lastMessages[chatId] == "undefined") lastMessages[chatId] = {};
    if (typeof lastMessages[chatId][type] == "undefined") {
      lastMessages[chatId][type] = [];
    }

    if (ctx.update.message.chat.type !== "private") {
      if (deletecommand)
        ctx.tg.deleteMessage(chatId, ctx.update.message.message_id);
      if (
        deleteprevious &&
        typeof lastMessages[chatId][type] !== "undefined" &&
        lastMessages[chatId][type] > 0
      ) {
        ctx.tg.deleteMessage(chatId, lastMessages[chatId][type]);
      }
    }

    var rep = replyto;
    if (typeof ctx.update.message.reply_to_message !== "undefined")
      rep = ctx.update.message.reply_to_message.message_id;

    if (image !== "") {
      var mes = ctx
        .replyWithPhoto(
          { source: image },
          { caption: message, parse_mode: "HTML", reply_to_message_id: rep }
        )
        .then(function (data) {
          lastMessages[chatId][type] = data.message_id;
        });
    } else if (video !== "") {
      var mes = ctx
        .replyWithVideo(
          { source: video },
          { caption: message, parse_mode: "HTML", reply_to_message_id: rep }
        )
        .then(function (data) {
          lastMessages[chatId][type] = data.message_id;
        });
    } else {
      var mes = ctx
        .replyWithHTML(
          message,
          Extra.inReplyTo(rep)
            .webPreview(showpreview)
            .HTML()
            .markup((m) => {
              let list = [];

              buttons.forEach((element) => {
                list.push(m.urlButton(element.title, element.url));
              });

              return m.inlineKeyboard(list);
            })
        )
        .then(function (data) {
          lastMessages[chatId][type] = data.message_id;
        });
    }
  },
};
