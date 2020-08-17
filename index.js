const {token, prefix, databaseURL} = require('./config.js');
const serviceAccount = require("./db.config.json");

const Discord = require('discord.js');
const admin = require('firebase-admin');
const client = new Discord.Client({partials: ['MESSAGE', 'CHANNEL', 'REACTION']});

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL,
});

const db = admin.firestore();

client.once('ready', async () => {
    console.log('Discord Ready');
    setCommands();
});

const commands = [
    {
        name: 'add scoreboard',
        description: 'Start tracking user engagement by counting total messages per user',
        execute(message) {
            message.channel.send('Okay, keeping a tally of user messages for this channel');
            console.log('Following channel', message.channel.name);
            return followChannel(message);
        },
    },
    {
        name: 'remove scoreboard',
        description: 'Stop tracking user engagement by counting total messages per user',
        execute(message) {
            message.channel.send('Okay, no longer keeping a tally of messages here');
            console.log('Unfollowing channel', message.channel.name);
            return unfollowChannel(message);
        },
    },
    {
        name: 'get scoreboard',
        description: 'Get a 7 day rolling tally of user messages',
        async execute(message) {
            const scoreboard = await getChannelStats(message);
            return message.channel.send(displayScoreboard(message.channel.name, scoreboard));
        },
    }
];

const followChannel = async (message) =>
    // todo: if moderator
    await db.collection('channels').doc(message.channel.id).set({
        name: message.channel.name,
        time: Date.now(),
        follow: true,
    });

const unfollowChannel = async (message) =>
    // todo: if moderator
    await db.collection('channels').doc(message.channel.id).set({
        name: message.channel.name,
        time: Date.now(),
        follow: false,
    });

const getChannelStats = async (message) => {
    console.log('Generating stats for channel:', message.channel.name);

    let channelUserRef = db.collection('channels').doc(message.channel.id).collection('users');
    // todo: Only fetch where users have recent messages (lastUpdated)
    const channelUsers = await channelUserRef.get();

    let scoreboard = [];
    let channelUserCollection = [];

    channelUsers.forEach( user => channelUserCollection.push(user));

    for (const user of channelUserCollection)  {
        const { authorName } = user.data();
        // todo: Only get messages from the last seven days
        const userTally = await channelUserRef.doc(user.id).collection('messages').get();

        scoreboard.push({
            name: authorName,
            value: `${userTally.size}`,
            inline: true
        })
    }

    scoreboard.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

    return scoreboard.slice(0, 5);
};

client.on('message', async message => {
    if (message.author.bot) return;

    const isFollowingChannel = await followingChannel(message.channel.id);
    if (isFollowingChannel) await addToAuthorTally(message.author, message.channel);

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim();
    const command = args.toLowerCase();

    if (!client.commands.has(command)) return;

    try {
        client.commands.get(command).execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('there was an error trying to execute that command!');
    }
});

const followingChannel = async (id) =>
    await db
        .collection('channels')
        .doc(id)
        .get()
        .then(channel => {
            if (!channel.exists) return false;
            const data = channel.data();
            return data.follow;
        });

const displayScoreboard = (channelName, scoreboard) =>
    new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`#${channelName} scoreboard`)
        .setDescription('Top contributors in the last 7 days')
        .addFields(scoreboard);

const addToAuthorTally = async (author, channel) => {
    let userCollection = db
        .collection('channels')
        .doc(channel.id)
        .collection('users')
        .doc(author.id);

    await userCollection
        .set({
            authorName: author.username,
            lastUpdated: Date.now()
        });

    await userCollection
        .collection('messages')
        .add(
            {
                authorName: author.username,
                channelName: channel.name,
                guildName: channel.guild.name,
                createdAt: Date.now()
            });
};

const setCommands = () => {
    client.commands = new Discord.Collection();
    for (const command of commands) {
        client.commands.set(command.name, command);
    }
};

client.login(token);
