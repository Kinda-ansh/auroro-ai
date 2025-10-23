
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const playerSchema = new Schema(
  {

    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dob: { type: String, trim: true },
    playerLevel: { type: String, trim: true, default: '' },
    playerRating: { type: Number, default: 1200 },
    playerRank: { type: Number, default: 0 },
    playerPoints: { type: Number, default: 0 },
    playerWins: { type: Number, default: 0 },
    playerLosses: { type: Number, default: 0 },
    country: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    avatar: { type: String, trim: true, default: '' },
  },
  {
    toJSON: { getters: true },
    timestamps: true,
  }
);

const Player = model('Player', playerSchema);

export default Player;
