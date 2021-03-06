/**
 * Cells grid provides the basic behavior to add and remove cells inside itself, and is the responsible of checking the consistency
 * of them regarding their boundaries and the resolution (the dimension of each cell inside) among other attributes.
 *
 * Also it provides methods to create the new generation of cells within.
 */

const AppException = require('../../exception/AppException')
const ContextUnawareCell = require('./ContextUnawareCell')
const logger = require('log4js').getLogger('CellsGrid')

class CellsGrid {
  constructor () {
    this.createdOn = new Date()
    this.name = null
    this.cells = {}
    this.maxWidth = 3200
    this.maxHeight = 3200
    this.resolution = 10
  }

  removeCells (...cellsConfig) {
    cellsConfig
      .forEach(config => this.checkValidPosition(config.position))

    let validCellsConfig = cellsConfig
      .filter(cellConfig => this.cells[cellConfig.position.x] && this.cells[cellConfig.position.x][cellConfig.position.y])

    if (validCellsConfig.length === cellsConfig.length) {
      cellsConfig.forEach(cellConfig => {
        // TODO Review if this is the best approach memory-wise
        delete this.cells[cellConfig.position.x][cellConfig.position.y]
      })
    } else {
      throw new AppException(
        'error.game.cellsGrid.canNotRemoveCellThatDoesNotExists.title',
        'error.game.cellsGrid.canNotRemoveCellThatDoesNotExists.body',
        { cellsConfig: cellsConfig, validCellsConfig: validCellsConfig }
      )
    }
  }

  /**
   * This will normalize the given coordinates to they possible positions in the grid given a raw position that doesn't have
   * into account the resolution of the grid
   */
  normalizeGridPosition (rawPosition) {
    if (!this.resolution || this.resolution < 0) {
      throw new AppException(
        'error.game.cellsGrid.invalidResolution.title',
        'error.game.cellsGrid.invalidResolution.body',
        {receivedResolution: this.resolution}
      )
    }

    let returnValue = {
      x: Math.round((rawPosition.x - (this.resolution / 2)) / this.resolution) * this.resolution,
      y: Math.round((rawPosition.y - (this.resolution / 2)) / this.resolution) * this.resolution
    }

    if (returnValue.x === +0) {
      returnValue.x = 0
    }

    if (returnValue.y === +0) {
      returnValue.y = 0
    }

    return returnValue
  }

  checkValidPosition (position, avoidThrowingException) {
    let validBoundsReceived = (Array.prototype.slice.call(arguments).length > 0) && position instanceof Object && !isNaN(parseFloat(position.x)) && !isNaN(parseFloat(position.y))
    validBoundsReceived = validBoundsReceived && (position.x <= this.maxWidth && position.x >= 0) && (position.y <= this.maxHeight && position.y >= 0)

    if (!validBoundsReceived && !avoidThrowingException) {
      let errorArguments = {invalidPosition: null}

      if (position) {
        errorArguments = { invalidPosition: { x: position.x, y: position.y } }
      }

      throw new AppException(
        'error.game.cellsGrid.cellAtInvalidPosition.title',
        'error.game.cellsGrid.cellAtInvalidPosition.body',
        errorArguments
      )
    }

    return validBoundsReceived
  }

  /**
  * This function expects normalized position index for both x and y axis, and returns an array
  * with the normalized positions around that point that have cells on the grid.
  */
  nearbyPositions (stringX, stringY) {
    let x = parseInt(stringX)
    let y = parseInt(stringY)

    this.checkValidPosition({ x: x, y: y })

    let positionsArray = [
      { x: x - this.resolution, y: y + this.resolution },
      { x: x - this.resolution, y: y },
      { x: x - this.resolution, y: y - this.resolution },
      { x: x, y: y + this.resolution },
      { x: x, y: y - this.resolution },
      { x: x + this.resolution, y: y },
      { x: x + this.resolution, y: y + this.resolution },
      { x: x + this.resolution, y: y - this.resolution }
    ]

    positionsArray = positionsArray.filter(position => this.checkValidPosition(position, true))

    return positionsArray
  }

  /**
  * This function expects normalized position index for both x and y axis, and returns an array
  * with the cells around that point on the grid.
  */
  nearbyCellsOfPosition (stringX, stringY) {
    let positionsArray = this.nearbyPositions(stringX, stringY)

    let result = []

    for (let i = 0; i < positionsArray.length; i++) {
      let position = positionsArray[i]

      let cell = this.cells[position.x] && this.cells[position.x][position.y]

      if (cell) {
        result.push(cell)
      }
    }

    return result
  }

  forEachCell (aParticularFunction) {
    for (let x in this.cells) {
      for (let y in this.cells[x]) {
        aParticularFunction.call(aParticularFunction, this.cells[x][y], x, y)
      }
    }
  }

  calculatePossibleDeadCellsPositions () {
    // Any live cell with fewer than two live neighbours dies, as if caused by under-population.
    // Any live cell with more than three live neighbours dies, as if by overcrowding.
    let possibleDeadCells = []

    this.forEachCell((cell, x, y) => {
      let nearCellsCount = this.nearbyCellsOfPosition(x, y).length

      if (nearCellsCount > 3 || nearCellsCount < 2) {
        possibleDeadCells.push({position: { x: x, y: y }})
      }
    })

    return possibleDeadCells
  }

  /** Expects input as 'nnnnnn' where each nn is a 2 character hex number for an RGB color value
   * e.g. #3f33c6
   * Returns the average as a hex number without leading #
   */
  averageRGB (arrayOfColours) {
    // Keep helper stuff in closures
    let hexRegex = /^[a-f\d]{6}$/gi

    let arrayOfHexColours = arrayOfColours
      .map(string => string.toLowerCase())
      .filter(color => color.match(hexRegex))
      .map(string => parseInt(string, 16))

    if (arrayOfHexColours.length !== arrayOfColours.length) {
      throw new AppException(
        'error.game.cellsGrid.malformedColor.title',
        'error.game.cellsGrid.malformedColor.body',
        arrayOfColours
      )
    }

    let result = arrayOfHexColours
      .reduce((total, element) => total + element)

    result = parseInt(result / arrayOfHexColours.length)
    result = `000000${result.toString(16)}`.slice(-6)

    return result
  }

  doAddCells (...cellsConfig) {
    cellsConfig
      .forEach(config => this.checkValidPosition(config.position))

    let validCellsConfig = cellsConfig
      .filter(cellConfig => !this.cells[cellConfig.position.x] || !this.cells[cellConfig.position.x][cellConfig.position.y])

    if (validCellsConfig.length === cellsConfig.length) {
      validCellsConfig.forEach(cellConfig => {
        if (!this.cells[cellConfig.position.x]) {
          this.cells[cellConfig.position.x] = {}
        }

        this.cells[cellConfig.position.x][cellConfig.position.y] = cellConfig.cell
      })
    } else {
      throw new AppException(
        'error.game.cellsGrid.cellCantBeOverride.title',
        'error.game.cellsGrid.cellCantBeOverride.body',
        { cellsConfig: cellsConfig, validCellsConfig: validCellsConfig }
      )
    }
  }

  addCellsBy (user, ...rawPositions) {
    logger.trace(`Creating cell with data: ${JSON.stringify(rawPositions)}`)
    let validCells = rawPositions
      .map(position => this.normalizeGridPosition(position))
      .map(position => {
        return { position: position, cell: new ContextUnawareCell(user) }
      })

    if (validCells.length === rawPositions.length && validCells.length > 0) {
      this.doAddCells(...validCells)
    }
  }

  killCellsBy (user, ...positions) {
    this.removeCells.apply(this, positions.map(aPosition => {
      return {position: this.normalizeGridPosition(aPosition)}
    }))
  }

  automaticallyCreateNewCells () {
    // Any dead cell with exactly three live neighbours becomes a live cell, as if by reproduction.
    let newCells = []

    // TODO investigate a better way to deal with this use case.
    let newCellsMapping = {}

    // getting the cells that are around the already existing cells
    this.forEachCell((cell, x, y) => {
      this.nearbyPositions(x, y)
        .filter(position => !this.cells[position.x] || !this.cells[position.x][position.y])
        .filter(position => !(position.x === parseInt(x) && position.y === parseInt(y)))
        .forEach(position => {
          if (!newCellsMapping[position.x]) {
            newCellsMapping[position.x] = {}
          }

          newCellsMapping[position.x][position.y] = position
        })
    })

    for (let x in newCellsMapping) {
      for (let y in newCellsMapping[x]) {
        let nearCells = this.nearbyCellsOfPosition(x, y)

        if (nearCells.length === 3) {
          let newCell = new ContextUnawareCell()
          newCell.color = this.averageRGB(nearCells.map(cell => { return cell.getColor() }))

          newCells.push({ position: {x: x, y: y}, cell: newCell })
        }
      }
    }

    return newCells
  }

  stablishCellsNewGeneration () {
    let newCells = this.automaticallyCreateNewCells()
    console.log(`new Cells about to be added: ${JSON.stringify(newCells)}`)

    let deadCellPositions = this.calculatePossibleDeadCellsPositions()
    console.log(`Cells about to die: ${JSON.stringify(deadCellPositions)}`)

    this.removeCells.apply(this, deadCellPositions)

    this.doAddCells.apply(this, newCells)
  }

  toJSONObject () {
    let json = {}
    json.createdOn = this.createdOn.toISOString()
    json.name = this.name
    json.cells = {}
    json.maxWidth = this.maxWidth
    json.maxHeight = this.maxHeight
    json.resolution = this.resolution

    this.forEachCell((cell, x, y) => {
      if (!json.cells[x]) {
        json.cells[x] = {}
      }

      json.cells[x][y] = cell.toJSONObject()

      // adding contextual values to the cell serializated data
      json.cells[x][y].gridPosition = {x: x, y: y}
    })

    return json
  }
}

module.exports = CellsGrid
