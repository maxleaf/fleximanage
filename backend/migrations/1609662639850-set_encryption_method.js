// flexiWAN SD-WAN software - flexiEdge, flexiManage.
// For more information go to https://flexiwan.com
// Copyright (C) 2019  flexiWAN Ltd.

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const orgModel = require('../models/organizations');
const logger = require('../logging/logging')({ module: module.filename, type: 'migration' });

async function up () {
  try {
    // Add encryptionMethod field, set as 'pre-shared-key' to all existing organizations
    await orgModel.updateMany(
      {},
      { $set: { encryptionMethod: 'pre-shared-key' } },
      { upsert: false }
    );
  } catch (err) {
    logger.error('Database migration failed', {
      params: { collections: ['organizations'], operation: 'up', err: err.message }
    });
  }
}

async function down () {
  try {
    // Unset tunnelKeys field
    await orgModel.updateMany(
      {},
      { $unset: { encryptionMethod: '' } },
      { upsert: false }
    );
  } catch (err) {
    logger.error('Database migration failed', {
      params: { collections: ['organizations'], operation: 'down', err: err.message }
    });
  }
}

module.exports = { up, down };