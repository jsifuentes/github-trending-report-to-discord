import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import { getTrendingRepositoriesWithParams } from "./request.js";
import { readFile, writeFile } from './cache.js';

async function getRepoMessages(periods, seenRepos) {
    let messages = [];
    let newSeen = seenRepos;

    for (let period in periods) {
        const repos = periods[period];

        messages = messages.concat(repos.map((repo, index) => {
            let description = repo.description || "";
            if (description.length > 200) {
                description = description.substring(0, 200) + '...';
            }

            const repoId = `${repo.owner}/${repo.name}`;
            const seen = seenRepos.includes(repoId);

            if (!seen) {
                newSeen.push(repoId);
            }
    
            return (!seen ? `:new: ` : '') +
                `#${index + 1} [${period}]: <https://github.com/${repo.owner}/${repo.name}>\n` +
                (description.length > 0 ? `> ${description}\n` : '') +
                `💻 Language: ${repo.language} | 🍴 Forks: ${repo.forks} | ⭐️ Stars: ${repo.stars} (${repo.starsToday})`;
        }));
    }

    return { messages, newSeen };
}

async function createDiscordCompliantMessages(messages) {
    let discordMessages = [];

    let currentMessage = '';
    for (let message of messages) {
        if (currentMessage.length + message.length > 2000) {
            discordMessages.push(currentMessage);
            currentMessage = '';
        }

        currentMessage += message + '\n--\n';
    }

    if (currentMessage.length > 0) {
        discordMessages.push(currentMessage);
    }

    return discordMessages;
}

async function main() {
    console.log('Starting up...');

    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;

    if (!token) {
        console.error('No Discord bot token provided.');
        return;
    }

    if (!channelId) {
        console.error('No Discord channel ID provided.');
        return;
    }

    // Create a new client instance
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    function shutdown() {
        console.log('Shutting down...');
        client.destroy();
    }

    // register a ctrl+c handler to gracefully kill the client
    for (const signal of ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'unhandledRejection']) {
        process.on(signal, () => {
            shutdown();
        });
    }

    client.once(Events.ClientReady, async readyClient => {
        console.log(`Ready! Logged in as ${readyClient.user.tag}`);

        try {
            const channel = await readyClient.channels.fetch(channelId);
            if (!channel) {
                console.error(`Could not find channel with ID ${channelId}`);
                shutdown();
                return;
            }

            let sentMessageIds = [];
            try {
                sentMessageIds = await readFile('sentMessageIds.json');
            } catch (e) {
                sentMessageIds = [];
            }

            // which repos have we seen?
            let seenRepos = [];
            try {
                seenRepos = await readFile('seenRepos.json');
            } catch (e) {
                seenRepos = [];
            }

            const newSentMessageIds = [];
            // the ids in this file are ordered [oldest, ..., newest], so messages would be deleted at the end if they are not needed.

            const { messages: sections, newSeen } = await getRepoMessages({
                weekly: await getTrendingRepositoriesWithParams('since=weekly'),
                daily: await getTrendingRepositoriesWithParams('since=daily'),
                weekly_english: await getTrendingRepositoriesWithParams('since=weekly&spoken_language_code=en'),
                daily_english: await getTrendingRepositoriesWithParams('since=daily&spoken_language_code=en'),
            }, seenRepos);
            const messages = await createDiscordCompliantMessages(sections);
            
            for (let i = 0; i < messages.length; i++) {
                // if we have already sent a message, edit it
                if (typeof sentMessageIds[i] !== 'undefined') {
                    console.log('editing message id ', sentMessageIds[i], ' for index ', i);

                    try {
                        const message = await channel.messages.fetch(sentMessageIds[i]);
                        await message.edit(messages[i]);
                        await message.suppressEmbeds(true);
                        continue;
                    } catch (e) {
                        console.error('Error editing message. Making a new one.', e);
                    }
                }

                // otherwise, send a new message
                console.log('sending new message for index ', i);
                const message = await channel.send(messages[i], {
                    content: messages[i],
                    flags: MessageFlags.SuppressEmbeds,
                });
                await message.suppressEmbeds(true);
                newSentMessageIds.push(message.id);
            }

            // delete any extra messages
            for (let i = messages.length; i < sentMessageIds.length; i++) {
                const message = await channel.messages.fetch(sentMessageIds[i]);
                console.log('deleting message id ', sentMessageIds[i]);
                await message.delete();
            }

            // write the new message ids to the file
            if (newSentMessageIds.length > 0) {
                await writeFile('sentMessageIds.json', sentMessageIds.concat(newSentMessageIds));
            }

            await writeFile('seenRepos.json', newSeen);

            shutdown();
        } catch (e) {
            console.error('An error occurred:', e);
            shutdown();
        }
    });

    client.login(token);
}

main()
  .catch(console.error);
