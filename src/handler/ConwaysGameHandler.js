/**
 * ConwaysGameHandlerConfigurator it's a class that implements the behavior needed to handle the
 * eventualities associated with the behavior of the game itself, by providing the proper WebSocket
 * interface to clients. All the communication held while playing a game will be received by this handler.
 *
 * It colaborates with specific Logic managers (UserBusinessLogicManager and
 * ConwaysGameBusinessLogicManager) on those mathers related with business logic behavior implementation.
 *
 * Other responsibility that this handler has is to cordinate the handlers for grid cells refreshal.
 */

const ExceptionCatcher = require('../exception/ExceptionCatcher')
const AppException = require('../exception/AppException')

const logger = require('log4js').getLogger('Conway\'s Game Handler')

class ConwaysGameHandlerConfigurator {
  constructor (io, businessLogicManagersHolder) {
    this.createdOn = new Date()
    this.io = io
    this.gameTickHandler = {}
    this.exceptionCatcher = new ExceptionCatcher(this.sendErrorToClient.bind(this))
    this.conwaysGameBusinessLogicManager = businessLogicManagersHolder.ConwaysGameBusinessLogicManager
    this.userBusinessLogicManager = businessLogicManagersHolder.UserBusinessLogicManager

    io.on(
      'connection',
      socket => this.configureSocketUponConnection(socket, io))
  }

  configureSocketUponConnection (socket, io) {
    let exceptionCatcher = new ExceptionCatcher(errorObject => socket.emit('appException', errorObject))
    let self = this

    socket
      .on('createGame', data => exceptionCatcher.runProtected(() => self.createGame(socket, data)))
      .on('startGame', data => exceptionCatcher.runProtected(() => self.startGame(socket, data)))
      .on('getTemplateCellsOptions', data => exceptionCatcher.runProtected(() => self.sendTemplateCellsOptionsToSocket(socket, data)))
      .on('forceEnd', data => exceptionCatcher.runProtected(() => self.forceStopGame(socket, data)))
      .on('createCell', data => exceptionCatcher.runProtected(() => self.createCell(socket, data)))
      .on('createTemplate', data => exceptionCatcher.runProtected(() => self.createTemplate(socket, data)))
      .on('killCell', data => exceptionCatcher.runProtected(() => self.killCell(socket, data)))
      .on('joinGame', data => exceptionCatcher.runProtected(() => self.joinGame(socket, data)))
  }

  getGameChannel (game) {
    return this.io.to(game.getRoomId())
  }

  sendErrorToClient (appException) {
    this.getGameChannel().emit(appException.isUnexpected() ? 'error' : 'appException', appException.toString())
  }

  sendGridRefreshToClient (game) {
    let jsonData = game.toJSONObject()
    logger.trace(`Sending data table to client: ${JSON.stringify(jsonData)}`)

    this.getGameChannel(game).emit('refreshCellsGrid', jsonData)
  }

  checkValidRoomForUser (game, userId) {
    if (!game.retrieveUserWithId(userId)) {
      throw new AppException(
        'error.game.user.invalidGameForUser.title',
        'error.game.user.invalidGameForUser.body',
        userId
      )
    }
  }

  startGame (socket, data) {
    logger.debug(`Received request for game start with arguments #${JSON.stringify(data)}`)
    let game = this.conwaysGameBusinessLogicManager.getGameForUserId(data.game.id, data.game.ownerId)
    this.checkValidRoomForUser(game, data.user.id)

    logger.debug(`Starting game #${game.id}`)

    this.gameTickHandler[game.id] = setInterval(
      () => {
        let game = this.conwaysGameBusinessLogicManager.getGameById(data.game.id)
        game.refreshCellsGrids()

        this.sendGameDataToPlayers(game)
      },
      game.refreshInterval)

    logger.debug(`Game #${data.game.id} started`)
  }

  sendGameDataToPlayers (game) {
    let jsonData = game.toJSONObject()
    logger.debug(`Sending data table to client: ${JSON.stringify(jsonData)}`)

    this.getGameChannel(game).emit('refreshCellsGrid', jsonData)
  }

  releaseResourcesFor (socket, data) {
    let gamesAffected = this.conwaysGameBusinessLogicManager.removeGamesForUserId(data.user.id)

    for (let i = 0; i < gamesAffected.deleted.length; i++) {
      let game = gamesAffected.deleted[i]
      this.forceStopGame(socket, {game: {id: game.id}})
      socket.leave(game.getRoomId())
    }

    for (let i = 0; i < gamesAffected.changedOwnership.length; i++) {
      let game = gamesAffected.changedOwnership[i]
      socket.leave(game.getRoomId())
      logger.debug(`Sending ownership change for game id ${game.id} and ownerId ${game.ownerId}`)

      let gameData = game.getDescriptiveJSONObject()
      gameData.previousOwnerId = data.user.id
      this.getGameChannel(game).emit('ownershipChanged', gameData)
    }
  }

  forceStopGame (socket, data) {
    clearInterval(this.gameTickHandler[data.game.id])
  }

  joinGame (socket, data) {
    logger.debug(`Joining to game with data sent by client: ${JSON.stringify(data)}`)
    let game = this.conwaysGameBusinessLogicManager.getGameById(data.game.id)
    let user = this.userBusinessLogicManager.getUserById(data.user.id)
    game.addUser({id: user.id, name: user.name, color: data.user.color})

    this.doJoinRoom(socket, game, (socket, game) => {
      let gameData = game.getDescriptiveJSONObject()
      logger.debug(`Sending the signal for joining a game with data: ${JSON.stringify(gameData)}`)
      socket.emit('joinedToGame', gameData)
    })
  }

  removeUser () {
    logger.warn(`"removeUser" functionality not implemented yet`)
  }

  updateUser () {
    logger.warn(`"updateUser" functionality not implemented yet`)
  }

  updateConfiguration () {
    logger.warn(`"updateConfiguration" functionality not implemented yet`)
  }

  createCell (socket, cellCreationData) {
    logger.debug(`Just received cell creation data from client: ${JSON.stringify(cellCreationData)}`)

    let game = this.conwaysGameBusinessLogicManager.getGameForUserId(cellCreationData.game.id, cellCreationData.game.ownerId)

    let cellRawData = cellCreationData.eventPosition

    logger.debug(`Creating cell with data: ${JSON.stringify(cellRawData)}`)

    game.createCellsBy(cellCreationData.user.id, 0, [cellRawData])
    this.sendGridRefreshToClient(game)
  }

  createTemplate (socket, templateCreationData) {
    logger.debug(`Creating template with ${JSON.stringify(templateCreationData)}`)

    let game = this.conwaysGameBusinessLogicManager.getGameForUserId(templateCreationData.game.id, templateCreationData.game.ownerId)

    game.createCellsOfTemplateBy(templateCreationData.user.id, 0, templateCreationData)
    this.sendGridRefreshToClient(game)
  }

  killCell (cellAssasinationData, socket) {
    let game = this.conwaysGameBusinessLogicManager.getGameForUserId(cellAssasinationData.game.id, cellAssasinationData.game.ownerId)
    game.cellsGrids[0].killCellsByAsync(cellAssasinationData.user, cellAssasinationData instanceof Array ? cellAssasinationData : [cellAssasinationData])
      .catch(this.exceptionCatcher.dealWithException.bind(this.exceptionCatcher))
  }

  sendTemplateCellsOptionsToSocket (socket, data, game) {
    let gameRetrieved = game || this.conwaysGameBusinessLogicManager.getGameForUserId(data.game.id, data.game.ownerId)
    socket.emit(
      'setTemplateCellsOptions',
      gameRetrieved.getPresetConfigurations())
  }

  createGame (socket, data) {
    logger.debug(`Just received game creation data from client: ${JSON.stringify(data)}`)
    let user = this.userBusinessLogicManager.getUserById(data.user.id)
    let game = this.conwaysGameBusinessLogicManager.createGame(data, {id: user.id, name: user.name, color: data.user.color})

    this.doJoinRoom(socket, game, (socket, game) => {
      let gameData = game.getDescriptiveJSONObject()
      logger.debug(`Sending the signal for game created with data: ${JSON.stringify(gameData)}`)
      this.io.to(socket.id).emit('gameCreated', gameData)
    })
  }

  doJoinRoom (socket, game, clientEventSender) {
    logger.debug(`Wiring socket with the propper events for the channel ${game.getRoomId()}`)
    socket.join(
      game.getRoomId(),
      () => {
        let gameChannel = this.getGameChannel(game)
        logger.debug(`Wiring socket with the propper events for the channel ${game.getRoomId()}`)

        gameChannel.on('updateConfiguration', this.updateConfiguration)
        gameChannel.on('removeUser', this.removeUser)
        gameChannel.on('updateUser', this.updateUser)

        logger.debug(`Sending replies to the owner of the game at socket #${socket.id}`)

        clientEventSender.call(this, socket, game)

        this.sendGridRefreshToClient(game)
        this.sendTemplateCellsOptionsToSocket(socket, null, game)
      }
    )
  }
}

module.exports = ConwaysGameHandlerConfigurator
