class AbstractRecogniser {
    async recognise() {
        throw new Error("recognise method not implemented")
    }
}

module.exports = AbstractRecogniser;