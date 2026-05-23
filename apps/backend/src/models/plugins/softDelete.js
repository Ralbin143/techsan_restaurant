export function softDeletePlugin(schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  });

  schema.pre(/^find/, function (next) {
    if (this.getOptions().includeDeleted) return next();
    this.where({ isDeleted: { $ne: true } });
    next();
  });

  schema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  schema.statics.findDeleted = function (filter = {}) {
    return this.find({ ...filter, isDeleted: true }).setOptions({ includeDeleted: true });
  };
}
