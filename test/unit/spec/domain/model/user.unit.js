const chai = require('chai')
const expect = chai.expect

const User = require('../../../../../src/domain/model/User')

describe('User', function () {
  let user = null

  it('should be able to be created', function () {
    expect(() => user = new User()).to.not.throw(Error)

    expect(user).to.not.be.null
  })

  user = new User()

  describe('Checking instance values upon creation', function () {
    it('should have default values set already', function () {
      expect(user).to.have.property('createdOn').and.not.be.null
      expect(user).to.have.property('id').and.to.be.null
      expect(user).to.have.property('name').and.to.be.equal('')
      expect(user).to.have.property('email').and.to.be.equal('')
      expect(user).to.have.property('password').and.to.be.equal('')
    })

    it('should return a proper JSON representation', function () {
      let jsonObject = user.toJSONObject()

      expect(jsonObject).to.have.property('id').and.to.be.null
      expect(jsonObject).to.have.property('name').and.to.be.a('string')
      expect(jsonObject).to.have.property('createdOn').and.not.be.null

      expect(Object.keys(jsonObject)).lengthOf(3)
    })
  })

  describe('Checking instance values modification', function () {
    it('should have proper values set', function () {
      user.createdOn = null
      user.name = 'adfasdf'

      expect(user).to.have.property('createdOn').and.be.null
      expect(user).to.have.property('name').and.to.be.equal('adfasdf')
    })

    it('should return a proper JSON representation', function () {
      user.createdOn = new Date()
      user.id = 'asdf'

      let jsonObject = user.toJSONObject()

      expect(jsonObject).to.have.property('name').and.to.be.a('string')
      expect(jsonObject).to.have.property('id').and.to.not.be.null
      expect(jsonObject).to.have.property('createdOn').and.to.not.be.null
    })
  })
})
