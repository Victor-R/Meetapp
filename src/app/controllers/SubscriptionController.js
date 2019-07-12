import * as Yup from 'yup';
import { isBefore } from 'date-fns';
import { Op } from 'sequelize';
import Meetup from '../models/Meetup';
import Subscription from '../models/Subscription';

class SubscriptionController {
  async index(req, res) {
    const subscriptions = await Subscription.findAll({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
          required: true,
        },
      ],
      order: [[Meetup, 'date']],
    });
    return res.json(subscriptions);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      meetup_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Please inform the meetup' });
    }

    const { meetup_id } = req.body;

    const meetup = await Meetup.findByPk(meetup_id);

    if (!meetup) {
      return res.status(400).json({ error: 'Meetup not found' });
    }

    if (meetup.user_id === req.userId) {
      return res.status(401).json({ error: 'User is the organizer' });
    }

    if (isBefore(meetup.date, new Date())) {
      return res.status(401).json({ error: 'Cannot subscribe past meetups' });
    }

    const isUserSubscribed = await Subscription.findOne({
      where: { user_id: req.userId, meetup_id },
    });

    if (isUserSubscribed) {
      return res
        .status(401)
        .json({ error: "User Can't subscribe twice in the same meetup" });
    }

    const conflictOfDates = await Subscription.findOne({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          required: true,
          where: {
            date: meetup.date,
          },
        },
      ],
    });

    if (conflictOfDates) {
      return res
        .status(401)
        .json({ error: "Can't subscribe to two meetups with the same date" });
    }

    const subscription = await Subscription.create({
      user_id: req.userId,
      meetup_id,
    });

    return res.json(subscription);
  }
}

export default new SubscriptionController();
