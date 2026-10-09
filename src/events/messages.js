const { Events } = require('discord.js');
const { logMessageDelete, logMessageUpdate } = require('../utils/logger');

module.exports = [
  {
    name: Events.MessageDelete,
    /**
     * @param {import('discord.js').Message} message
     */
    async execute(message) {
      if (!message.guild) return;
      if (message.author?.bot) return;

      const author = message.author || null;
      const content = message.content || null;
      const attachments = message.attachments ? Array.from(message.attachments.values()) : [];

      try {
        await logMessageDelete(message.guild, {
          channel: message.channel,
          author,
          content,
          attachments
        });
      } catch (err) {
        console.error('[Events: MessageDelete] Ошибка при логировании:', err);
      }
    }
  },
  {
    name: Events.MessageUpdate,
    /**
     * @param {import('discord.js').Message} oldMessage
     * @param {import('discord.js').Message} newMessage
     */
    async execute(oldMessage, newMessage) {
      if (!newMessage.guild) return;
      if (newMessage.author?.bot || oldMessage.author?.bot) return;

      // Если текст остался прежним (например, подгрузился Embed превью ссылки)
      if (oldMessage.content === newMessage.content) return;

      try {
        await logMessageUpdate(newMessage.guild, {
          channel: newMessage.channel,
          author: newMessage.author || oldMessage.author || null,
          oldContent: oldMessage.content || null,
          newContent: newMessage.content || null,
          messageUrl: newMessage.url
        });
      } catch (err) {
        console.error('[Events: MessageUpdate] Ошибка при логировании:', err);
      }
    }
  }
];
