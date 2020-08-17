const {token, prefix, databaseURL} = require('./config.js');
const Discord = require('discord.js');
const admin = require('firebase-admin');
const client = new Discord.Client({partials: ['MESSAGE', 'CHANNEL', 'REACTION']});
const serviceAccount = require("./portal-bot-db-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL,
});

const db = admin.firestore();

client.once('ready', async () => {
    console.log('Discord Ready');
    console.log(`Your prefix is ${prefix}`);
    setCommands();
});

client.on('message', async message => {
    if (message.author.bot) return;

    const watchingChannel = await isWatchingChannel(message.channel.id);
    if (watchingChannel) await addToAuthorTally(message.author, message.channel);

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (!client.commands.has(command)) return;

    try {
        client.commands.get(command).execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('there was an error trying to execute that command!');
    }
});

const commands = [
    {
        name: 'followchannel',
        description: 'Start tracking user engagement by counting total messages per user',
        execute(message) {
            message.channel.send('Okay, keeping a tally of user messages for this channel');
            return followChannel(message);
        },
    },
    {
        name: 'unfollowchannel',
        description: 'Stop tracking user engagement by counting total messages per user',
        execute(message) {
            message.channel.send('Okay, no longer keeping a tally of user messages for this channel');
            return unfollowChannel(message);
        },
    },
    {
        name: 'getstats',
        description: 'Get a 7 day rolling tally of user messages',
        execute(message) {
            message.channel.send('Okay, no longer keeping a tally of user messages for this channel');
            return getStats(message);
        },
    }
];
const setCommands = () => {
    client.commands = new Discord.Collection();
    for (const command of commands) {
        client.commands.set(command.name, command);
    }
}

const followChannel = async (message) =>
    await db.collection('channels').doc(message.channel.id).set({
        name: message.channel.name,
        time: Date.now(),
        follow: true,
    });


const unfollowChannel = async (message) =>
    await db.collection('channels').doc(message.channel.id).set({
        name: message.channel.name,
        time: Date.now(),
        follow: false,
    })

const getStats = async (message) => {
    const channelUsers = await db.collection('channels').doc(message.channel.id).get();

    console.log(channelUsers);
}

const isWatchingChannel = async (id) =>
    await db
        .collection('channels')
        .doc(id)
        .get()
        .then(snap => {
            if (!snap.exists) return false;
            const data = snap.data();
            return data.follow;
        });

const addToAuthorTally = async (author, channel) =>
    await db
        .collection('channels')
        .doc(channel.id)
        .collection('users')
        .doc(author.id)
        .collection('messages')
        .add(
{
                authorName: author.username,
                channelName: channel.name,
                guildName: channel.guild.name,
                createdAt: Date.now()
            });

// Get a rolling 7 day stat of channel...

client.login(token);
