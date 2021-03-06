import * as Yup from 'yup';
import { isBefore, format } from 'date-fns';
import { Op } from 'sequelize';
import Meetup from '../models/Meetup';
import Subscription from '../models/Subscription';
import User from '../models/User';
import Mail from '../../lib/Mail';

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

    const meetup = await Meetup.findByPk(meetup_id, {
      include: [
        {
          model: User,
          as: 'organizer',
          attributes: ['name', 'email'],
        },
      ],
    });

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

    const userSubcribing = await User.findByPk(req.userId);

    await Mail.sendMail({
      to: `${meetup.organizer.name} <${meetup.organizer.email}>`,
      subject: 'Nova Inscrição',
      template: 'subscription',
      context: {
        organizer: meetup.organizer.name,
        user: userSubcribing.name,
        email: userSubcribing.email,
        title: meetup.title,
        date: format(meetup.date, 'dd/MM/yyyy - HH:mm'),
      },
    });

    return res.json(subscription);
  }
}

export default new SubscriptionController();
