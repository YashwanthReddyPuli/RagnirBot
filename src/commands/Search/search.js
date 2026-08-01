import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import axios from 'axios';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { getColor } from '../../config/bot.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '4e44d9029b1270a757cddc766a1bcb63';
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

export default {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search resources and databases')
        .addSubcommand(subcommand =>
            subcommand
                .setName('define')
                .setDescription('Look up a English dictionary word definition')
                .addStringOption(option => option.setName('word').setDescription('The word to look up').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('movie')
                .setDescription('Search TMDB for a movie or TV show details')
                .addStringOption(option => option.setName('title').setDescription('The title of the movie or TV show').setRequired(true).setMaxLength(100))
                .addStringOption(option => option.setName('type').setDescription('Type of content to search for').addChoices({ name: "Movie", value: "movie" }, { name: "TV Show", value: "tv" }).setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('urban')
                .setDescription('Search Urban Dictionary for slang definitions')
                .addStringOption(option => option.setName('term').setDescription('The term to look up on Urban Dictionary').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('google')
                .setDescription('Search Google for a query')
                .addStringOption(option => option.setName('query').setDescription('What would you like to search for?').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'define') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            try {
                const word = interaction.options.getString('word');
                if (word.length < 2) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Error', 'Please enter a word with at least 2 characters.')],
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 5000 });
                if (!response.data || response.data.length === 0) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Not Found', `No definitions found for "${word}".`)]
                    });
                }
                
                const data = response.data[0];
                const embed = createEmbed({
                    title: data.word,
                    description: data.phonetic ? `*${data.phonetic}*` : '',
                    color: 'success'
                });
                
                data.meanings.slice(0, 5).forEach(meaning => {
                    const definitions = meaning.definitions
                        .slice(0, 3)
                        .map((def, idx) => {
                            let text = `${idx + 1}. ${def.definition}`;
                            if (def.example) text += `\n   *Example: ${def.example}*`;
                            return text;
                        })
                        .join('\n\n');
                    
                    if (definitions) {
                        embed.addFields({ name: `**${meaning.partOfSpeech || 'Definition'}**`, value: definitions, inline: false });
                    }
                });
                
                embed.setFooter({ text: 'Powered by Free Dictionary API' });
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                if (error.response?.status === 404) {
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Not Found', `No definitions found for "${interaction.options.getString('word')}".`)]
                    });
                } else {
                    await handleInteractionError(interaction, error, { commandName: 'search define' });
                }
            }
        }

        else if (subcommand === 'movie') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            try {
                const guildConfig = await getGuildConfig(interaction.client, interaction.guild?.id);
                const title = interaction.options.getString("title");
                const type = interaction.options.getString("type") || "movie";

                const searchResponse = await axios.get(`https://api.themoviedb.org/3/search/${type}`, {
                    params: {
                        api_key: TMDB_API_KEY,
                        query: title,
                        include_adult: guildConfig?.allowNsfwContent ? undefined : false,
                        language: guildConfig?.language || "en-US",
                        page: 1,
                    },
                    timeout: 8000,
                });

                if (!searchResponse.data?.results?.length) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed("Not Found", `No ${type === "movie" ? "movies" : "TV shows"} found for "${title}".`)],
                    });
                }

                const result = searchResponse.data.results[0];
                const mediaType = type === "movie" ? "Movie" : "TV Show";
                const mediaTitle = result.title || result.name || "Unknown Title";
                const releaseDate = result.release_date || result.first_air_date;
                const year = releaseDate ? new Date(releaseDate).getFullYear() : "N/A";

                const detailsResponse = await axios.get(`https://api.themoviedb.org/3/${type}/${result.id}`, {
                    params: {
                        api_key: TMDB_API_KEY,
                        language: guildConfig?.language || "en-US",
                        append_to_response: "credits,release_dates,content_ratings",
                    },
                    timeout: 8000,
                });

                const details = detailsResponse.data;
                const runtime = details.runtime
                    ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m`
                    : details.episode_run_time?.[0]
                      ? `${details.episode_run_time[0]}m per episode`
                      : "N/A";

                let contentRating = "N/A";
                if (type === "movie") {
                    const usCert = details.release_dates?.results?.find(r => r.iso_3166_1 === "US");
                    if (usCert?.release_dates?.[0]?.certification) contentRating = usCert.release_dates[0].certification;
                } else {
                    const usCert = details.content_ratings?.results?.find(r => r.iso_3166_1 === "US");
                    if (usCert?.rating) contentRating = usCert.rating;
                }

                const genres = details.genres?.map(g => g.name).join(", ") || "N/A";
                const cast = details.credits?.cast?.slice(0, 3).map(p => p.name).join(", ") || "N/A";

                const embed = createEmbed({
                    title: `${mediaTitle} (${year})`,
                    description: details.overview || "No overview available.",
                    color: 'info'
                })
                    .setURL(`https://www.themoviedb.org/${type}/${result.id}`)
                    .setThumbnail(result.poster_path ? `${IMAGE_BASE_URL}${result.poster_path}` : null)
                    .addFields(
                        { name: "Type", value: mediaType, inline: true },
                        { name: "Rating", value: result.vote_average ? `⭐ ${result.vote_average.toFixed(1)}/10` : "N/A", inline: true },
                        { name: "Content Rating", value: contentRating, inline: true },
                        { name: "Runtime", value: runtime, inline: true },
                        { name: "Release Date", value: releaseDate ? new Date(releaseDate).toLocaleDateString() : "N/A", inline: true },
                        { name: "Genres", value: genres, inline: true },
                        { name: "Cast", value: cast, inline: false },
                    )
                    .setFooter({
                        text: "Powered by TMDB",
                        iconURL: "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg",
                    });

                if (result.backdrop_path) {
                    embed.setImage(`https://image.tmdb.org/t/p/w1280${result.backdrop_path}`);
                }

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                if (error.response?.status === 404) {
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Not Found', 'The requested movie/TV show could not be found.')]
                    });
                } else {
                    await handleInteractionError(interaction, error, { commandName: 'search movie' });
                }
            }
        }

        else if (subcommand === 'urban') {
            try {
                const term = interaction.options.getString('term');
                if (term.length < 2) {
                    return await InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed('Error', 'Please enter a term with at least 2 characters.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                let deferTimer = setTimeout(() => {
                    InteractionHelper.safeDefer(interaction).catch(() => {});
                }, 1500);

                const response = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`, { timeout: 5000 });
                clearTimeout(deferTimer);

                if (!response.data?.list?.length) {
                    return await InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed('Not Found', `No definitions found for "${term}" on Urban Dictionary.`)]
                    });
                }

                const definition = response.data.list[0];
                const cleanDefinition = definition.definition.replace(/\[|\]/g, '');
                const cleanExample = definition.example.replace(/\[|\]/g, '');
                const formattedDefinition = cleanDefinition.replace(/\n\s*\n/g, '\n\n').slice(0, 2000);
                const formattedExample = cleanExample ? `*"${cleanExample.slice(0, 500)}..."*` : '*No example provided*';

                const embed = createEmbed({
                    title: definition.word,
                    description: formattedDefinition,
                    color: 'info'
                })
                .setURL(definition.permalink)
                .addFields(
                    { name: 'Example', value: formattedExample, inline: false },
                    { name: 'Stats', value: `👍 ${definition.thumbs_up.toLocaleString()} • 👎 ${definition.thumbs_down.toLocaleString()}`, inline: true },
                    { name: 'Author', value: definition.author || 'Anonymous', inline: true }
                )
                .setFooter({ text: 'Urban Dictionary', iconURL: 'https://i.imgur.com/8aQrX3a.png' });

                await InteractionHelper.safeReply(interaction, { embeds: [embed] });
            } catch (error) {
                await handleInteractionError(interaction, error, { commandName: 'search urban' });
            }
        }

        else if (subcommand === 'google') {
            try {
                const query = interaction.options.getString('query');
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                const embed = createEmbed({
                    title: 'Google Search',
                    description: `[Search for "${query}"](${searchUrl})`,
                    color: 'info'
                }).setFooter({ text: 'Google Search Results' });
                await InteractionHelper.safeReply(interaction, { embeds: [embed] });
            } catch (error) {
                await handleInteractionError(interaction, error, { commandName: 'search google' });
            }
        }
    }
};
