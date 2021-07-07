// flexiWAN SD-WAN software - flexiEdge, flexiManage.
// For more information go to https://flexiwan.com
// Copyright (C) 2020  flexiWAN Ltd.

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

const Service = require('./Service');
const Tunnels = require('../models/tunnels');
const mongoose = require('mongoose');
const pick = require('lodash/pick');
const { getAccessTokenOrgList } = require('../utils/membershipUtils');
const deviceStatus = require('../periodic/deviceStatus')();

class TunnelsService {
  /**
   * Select the API fields from mongo Tunnel Object
   *
   * @param {mongo Tunnel Object} item
   */
  static selectTunnelParams (item) {
    // Pick relevant fields
    const retTunnel = pick(item, [
      'num',
      'isActive',
      'interfaceA',
      'interfaceB',
      'deviceA',
      'deviceAconf',
      'deviceB',
      'deviceBconf',
      'encryptionMethod',
      '_id',
      'pathlabel']);

    retTunnel.interfaceADetails =
      retTunnel.deviceA.interfaces.filter((ifc) => {
        return ifc._id.toString() === '' + retTunnel.interfaceA;
      })[0];
    retTunnel.interfaceBDetails =
      retTunnel.deviceB.interfaces.filter((ifc) => {
        return ifc._id.toString() === '' + retTunnel.interfaceB;
      })[0];

    const tunnelId = retTunnel.num;
    // Add tunnel status
    retTunnel.tunnelStatusA =
      deviceStatus.getTunnelStatus(retTunnel.deviceA.machineId, tunnelId) || {};

    // Add tunnel status
    retTunnel.tunnelStatusB =
      deviceStatus.getTunnelStatus(retTunnel.deviceB.machineId, tunnelId) || {};

    retTunnel.deviceA = pick(retTunnel.deviceA, ['_id', 'name']);
    retTunnel.deviceB = pick(retTunnel.deviceB, ['_id', 'name']);

    retTunnel._id = retTunnel._id.toString();

    return retTunnel;
  }

  /**
   * Retrieve device tunnels information
   *
   * id String Numeric ID of the Device to fetch tunnel information about
   * offset Integer The number of items to skip before starting to collect the result set (optional)
   * limit Integer The numbers of items to return (optional)
   * returns List
   **/
  static async tunnelsIdDELETE ({ id, org, offset, limit }, { user }) {
    try {
      const orgList = await getAccessTokenOrgList(user, org, true);
      const resp = await Tunnels.findOneAndUpdate(
        // Query
        { _id: mongoose.Types.ObjectId(id), org: { $in: orgList } },
        // Update
        { isActive: false },
        // Options
        { upsert: false, new: true });

      if (resp != null) {
        return Service.successResponse(null, 204);
      } else {
        return Service.rejectResponse(404);
      }
    } catch (e) {
      return Service.rejectResponse(
        e.message || 'Internal Server Error',
        e.status || 500
      );
    }
  }

  /**
   * Retrieve device tunnels information
   *
   * @param {String} id Numeric ID of the Device to fetch tunnel information about
   * @param {Integer} offset The number of items to skip before collecting the result (optional)
   * @param {Integer} limit The numbers of items to return (optional)
   * @param {String} sortField The field by which the data will be ordered (optional)
   * @param {String} sortOrder Sorting order [asc|desc] (optional)
   **/
  static async tunnelsGET ({ org, offset, limit, sortField, sortOrder }, { user }, response) {
    try {
      const orgList = await getAccessTokenOrgList(user, org, false);
      const pipeline = [
        {
          $match: {
            org: mongoose.Types.ObjectId(orgList[0]),
            isActive: true
          }
        }
      ];
      if (sortField) {
        const order = sortOrder.toLowerCase() === 'desc' ? -1 : 1;
        pipeline.push({
          $sort: { [sortField]: order }
        });
      };
      const paginationParams = [{
        $skip: offset > 0 ? +offset : 0
      }];
      if (limit !== undefined) {
        paginationParams.push({ $limit: +limit });
      };
      pipeline.push({
        $facet: {
          records: paginationParams,
          meta: [{ $count: 'total' }]
        }
      });

      const paginated = await Tunnels.aggregate(pipeline).allowDiskUse(true);
      if (paginationParams.length > 0) {
        response.setHeader('records-total', paginated[0].meta[0].total);
      };

      const result = await Tunnels
        .populate(paginated[0].records, [
          { path: 'deviceA', model: 'devices' },
          { path: 'deviceB', model: 'devices' },
          { path: 'pathlabel', model: 'PathLabels' }
        ]);

      const tunnelMap = result.map((d) => {
        return TunnelsService.selectTunnelParams(d);
      });

      return Service.successResponse(tunnelMap);
    } catch (e) {
      return Service.rejectResponse(
        e.message || 'Internal Server Error',
        e.status || 500
      );
    };
  }
}

module.exports = TunnelsService;
