const models = require("../libs/models");
const _ = require("lodash");
const { ApplicationCommandOptionType } = require("discord.js");

module.exports = (api) => ({
  name: "prices",
  description:
    "The different cryptocurrencies and their values in dollars. Usage: /prices [currency]",
  options: {
    currency: {
      description: "Currency to filter by",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  },
  handler: (ctx) => {
    let currency = null;
    if (ctx.platform === "discord") {
      currency = ctx?.getString("currency")?.toLowerCase();
    } else {
      currency = ctx?.getArg(1);
    }

    let currencies = _.chain(api.get("public", "currencies")).filter(
      (x) =>
        !x.hidden &&
        x.name !== "chips" &&
        x.name !== "chips_staking" &&
        !_.startsWith(x.name, "usd") &&
        !_.endsWith(x.name, "usd")
    );

    if (currency) {
      currencies = currencies.filter((x) => x.name.toLowerCase() === currency);
      if (currencies.value().length === 0) {
        return ctx.sendText(
          "Currency not found. Use /prices to see all available currencies."
        );
      }
    }

    return ctx.sendForm(models.prices(currencies.value()));
  },
});
