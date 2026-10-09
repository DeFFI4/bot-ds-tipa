const { Events, AuditLogEvent } = require('discord.js');
const { logChannelChange, logRoleStructureChange } = require('../utils/logger');
const { LOG_CHANNEL_NAME } = require('../config');

/**
 * Получение исполнителя из Audit Log для конкретного объекта
 */
async function getExecutor(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type });
    const entry = logs.entries.first();
    if (entry && entry.target?.id === targetId) {
      return entry.executor;
    }
  } catch {
    return null;
  }
  return null;
}

module.exports = [
  // 1. Создание канала
  {
    name: Events.ChannelCreate,
    /**
     * @param {import('discord.js').GuildChannel} channel
     */
    async execute(channel) {
      if (!channel.guild) return;
      // Игнорируем авто-создание канала логов ботом
      if (channel.name?.toLowerCase() === LOG_CHANNEL_NAME.toLowerCase()) return;

      const executor = await getExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
      try {
        await logChannelChange(channel.guild, {
          channel,
          executor,
          action: 'create',
          details: `Тип канала: \`${channel.type}\``
        });
      } catch (err) {
        console.error('[Events: ChannelCreate] Ошибка:', err);
      }
    }
  },

  // 2. Удаление канала
  {
    name: Events.ChannelDelete,
    /**
     * @param {import('discord.js').GuildChannel} channel
     */
    async execute(channel) {
      if (!channel.guild) return;

      const executor = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
      try {
        await logChannelChange(channel.guild, {
          channel,
          executor,
          action: 'delete',
          details: `Тип удаленного канала: \`${channel.type}\``
        });
      } catch (err) {
        console.error('[Events: ChannelDelete] Ошибка:', err);
      }
    }
  },

  // 3. Обновление канала
  {
    name: Events.ChannelUpdate,
    /**
     * @param {import('discord.js').GuildChannel} oldChannel
     * @param {import('discord.js').GuildChannel} newChannel
     */
    async execute(oldChannel, newChannel) {
      if (!newChannel.guild) return;

      const changes = [];
      if (oldChannel.name !== newChannel.name) {
        changes.push(`Имя: \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
      }
      if (oldChannel.topic !== newChannel.topic) {
        changes.push(`Тема канала была изменена`);
      }

      if (changes.length === 0) return;

      const executor = await getExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
      try {
        await logChannelChange(newChannel.guild, {
          channel: newChannel,
          executor,
          action: 'update',
          details: changes.join('\n')
        });
      } catch (err) {
        console.error('[Events: ChannelUpdate] Ошибка:', err);
      }
    }
  },

  // 4. Создание роли
  {
    name: Events.RoleCreate,
    /**
     * @param {import('discord.js').Role} role
     */
    async execute(role) {
      if (!role.guild) return;

      const executor = await getExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
      try {
        await logRoleStructureChange(role.guild, {
          role,
          executor,
          action: 'create',
          details: `Цвет: \`${role.hexColor}\``
        });
      } catch (err) {
        console.error('[Events: RoleCreate] Ошибка:', err);
      }
    }
  },

  // 5. Удаление роли
  {
    name: Events.RoleDelete,
    /**
     * @param {import('discord.js').Role} role
     */
    async execute(role) {
      if (!role.guild) return;

      const executor = await getExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
      try {
        await logRoleStructureChange(role.guild, {
          role,
          executor,
          action: 'delete',
          details: `Удалена роль с ID: \`${role.id}\``
        });
      } catch (err) {
        console.error('[Events: RoleDelete] Ошибка:', err);
      }
    }
  },

  // 6. Обновление роли
  {
    name: Events.RoleUpdate,
    /**
     * @param {import('discord.js').Role} oldRole
     * @param {import('discord.js').Role} newRole
     */
    async execute(oldRole, newRole) {
      if (!newRole.guild) return;

      const changes = [];
      if (oldRole.name !== newRole.name) {
        changes.push(`Имя: \`${oldRole.name}\` ➔ \`${newRole.name}\``);
      }
      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`Цвет: \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
      }
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        changes.push(`Права роли были модифицированы`);
      }

      if (changes.length === 0) return;

      const executor = await getExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
      try {
        await logRoleStructureChange(newRole.guild, {
          role: newRole,
          executor,
          action: 'update',
          details: changes.join('\n')
        });
      } catch (err) {
        console.error('[Events: RoleUpdate] Ошибка:', err);
      }
    }
  }
];
