/**
 * Prices Command
 * Displays current cryptocurrency prices in USD from the Chips.gg platform.
 * Supports an optional currency filter to show a specific coin's price.
 * Excludes internal tokens (chips, staking, USD-based) from the listing.
 */
const models = require("../libs/models");
const _ = require("lodash");
const { ApplicationCommandOptionType } = require("discord.js");
const { arg } = require("../libs/utils");

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
    const currency = arg(ctx, "currency", 1)?.toLowerCase();

    // Filter out hidden, internal, and USD-based currencies
    let currencies = _.chain(api.get("public", "currencies")).filter(
      (x) =>
        !x.hidden &&
        x.name !== "chips" &&
        x.name !== "chips_staking" &&
        !_.startsWith(x.name, "usd") &&
        !_.endsWith(x.name, "usd")
    );

    // Apply optional single-currency filter
    if (currency) {
      currencies = currencies.filter((x) => x.name.toLowerCase() === currency);
      if (currencies.value().length === 0) {
        return ctx.sendText(
          "Currency not found. Use /prices to see all available currencies."
        );
      }
    }

    // Format and send using the prices model
    return ctx.sendForm(models.prices(currencies.value()));
  },
});
