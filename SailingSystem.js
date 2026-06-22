import { navigationConfig } from '../../shared/config/navigationConfig.js';
import { normalizeAngle } from '../../shared/math/angle.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSpeed(ship) {
  return Math.sqrt(ship.velocityX * ship.velocityX + ship.velocityY * ship.velocityY);
}

function reduceVelocityToZero(ship, amount) {
  const speed = getSpeed(ship);

  if (speed <= 0.0001) {
    ship.velocityX = 0;
    ship.velocityY = 0;
    ship.speed = 0;
    return;
  }

  const newSpeed = Math.max(0, speed - amount);
  const ratio = newSpeed / speed;

  ship.velocityX *= ratio;
  ship.velocityY *= ratio;
  ship.speed = newSpeed;
}

export class SailingSystem {
  static update(ship, input, worldModel, deltaTime) {
    const cfg = navigationConfig;
    const dt = deltaTime;

    const wasAnchorDown = ship.anchorDown;

    // ==========================================================
    // 1. VELAME
    // ==========================================================
    if (input.sailUp) {
      ship.sail = Math.min(
        cfg.maxSail,
        ship.sail + cfg.sailChangeRate * dt
      );
    }

    if (input.sailDown) {
      ship.sail = Math.max(
        cfg.minSail,
        ship.sail - cfg.sailChangeRate * dt
      );
    }

    // ==========================================================
    // 2. LEME
    // ==========================================================
    if (input.rudderLeft) {
      ship.rudder = Math.max(
        -cfg.maxRudder,
        ship.rudder - cfg.rudderChangeRate * dt
      );
    } else if (input.rudderRight) {
      ship.rudder = Math.min(
        cfg.maxRudder,
        ship.rudder + cfg.rudderChangeRate * dt
      );
    } else {
      if (ship.rudder > 0) {
        ship.rudder = Math.max(
          0,
          ship.rudder - cfg.rudderReturnRate * dt
        );
      } else if (ship.rudder < 0) {
        ship.rudder = Math.min(
          0,
          ship.rudder + cfg.rudderReturnRate * dt
        );
      }
    }

    // ==========================================================
    // 3. ÂNCORA, TOGGLE PELO R
    // ==========================================================
    if (input.anchorToggle) {
      ship.anchorDown = !ship.anchorDown;
      input.anchorToggle = false;
    }

    const anchorJustDropped = !wasAnchorDown && ship.anchorDown;

    const headingX = Math.cos(ship.rotation);
    const headingY = Math.sin(ship.rotation);

    // ==========================================================
    // 4. PROPULSÃO, SOMENTE SE NÃO ESTIVER ANCORADO
    // ==========================================================
    if (!ship.anchorDown) {
      const windAngleDiff = normalizeAngle(ship.windAngle - ship.rotation);
      const cosWind = Math.cos(windAngleDiff);

      let windFactor = 1.0;

      if (cosWind > 0) {
        windFactor += cosWind * cfg.tailwindBonus;
      } else {
        windFactor += cosWind * (1.0 - cfg.headwindPenalty);
      }

      const forwardEffort =
        ship.sail *
        ship.windStrength *
        windFactor *
        cfg.baseAcceleration;

      ship.velocityX += headingX * forwardEffort * dt;
      ship.velocityY += headingY * forwardEffort * dt;
    }

    // ==========================================================
    // 5. ARRASTO NORMAL DA ÁGUA
    // ==========================================================
    let currentDrag = cfg.waterDrag;

    const dragFactor = clamp(1 - currentDrag * dt, 0, 1);

    ship.velocityX *= dragFactor;
    ship.velocityY *= dragFactor;

    // ==========================================================
    // 6. COMPORTAMENTO DA ÂNCORA
    // ==========================================================
    if (ship.anchorDown) {
      // Tranco inicial ao lançar a âncora.
      // Reduz a velocidade imediatamente, mas sem inverter o vetor.
      if (anchorJustDropped) {
        const shockFactor = cfg.anchorDropShockFactor ?? 0.35;

        ship.velocityX *= shockFactor;
        ship.velocityY *= shockFactor;
      }

      // Freio linear da âncora.
      // Aqui está a principal correção:
      // a velocidade é reduzida até zero, mas nunca passa para negativo.
      const anchorLinearBrake = cfg.anchorLinearBrake ?? 85.0;
      reduceVelocityToZero(ship, anchorLinearBrake * dt);

      // Se estiver quase parado, trava a velocidade em zero.
      const stopSpeed = cfg.anchorStopSpeed ?? 0.75;

      if (ship.speed <= stopSpeed) {
        ship.velocityX = 0;
        ship.velocityY = 0;
        ship.speed = 0;
      }

      // Giro com a âncora.
      // Mesmo parado, o navio pode rotacionar com A/D.
      const rudderRatio =
        cfg.maxRudder !== 0
          ? clamp(ship.rudder / cfg.maxRudder, -1, 1)
          : 0;

      const anchorTurnRate = cfg.anchorTurnRate ?? 6.0;
      const anchorPivotTurnRate = cfg.anchorPivotTurnRate ?? 1.8;
      const anchorMaxAngularVelocity = cfg.anchorMaxAngularVelocity ?? 3.0;
      const anchorAngularDrag = cfg.anchorAngularDrag ?? 0.18;

      if (Math.abs(rudderRatio) > 0.05) {
        const speedRatio = clamp(ship.speed / cfg.maxSpeed, 0, 1);

        // Quanto mais rápido, mais agressivo o cavalo de pau.
        // Mesmo parado, mantém giro de pivô para manobra em porto.
        const turnPower =
          anchorPivotTurnRate +
          anchorTurnRate * speedRatio;

        ship.angularVelocity += rudderRatio * turnPower * dt;
      } else {
        ship.angularVelocity *= clamp(1 - anchorAngularDrag, 0, 1);
      }

      ship.angularVelocity = clamp(
        ship.angularVelocity,
        -anchorMaxAngularVelocity,
        anchorMaxAngularVelocity
      );

      ship.rotation = normalizeAngle(
        ship.rotation + ship.angularVelocity * dt
      );

      // Importante:
      // Quando ancorado, não aplicamos o lateralDrag.
      // Com lateralDrag maior que 1, isso pode inverter o vetor e gerar marcha ré.
      return;
    }

    // ==========================================================
    // 7. VELOCIDADE NORMAL, SEM ÂNCORA
    // ==========================================================
    ship.speed = getSpeed(ship);

    if (ship.speed > cfg.maxSpeed) {
      const ratio = cfg.maxSpeed / ship.speed;

      ship.velocityX *= ratio;
      ship.velocityY *= ratio;
      ship.speed = cfg.maxSpeed;
    }

    // ==========================================================
    // 8. REDUÇÃO DE DRIFT LATERAL
    // ==========================================================
    const forwardVelMag =
      ship.velocityX * headingX +
      ship.velocityY * headingY;

    ship.velocityX =
      headingX * forwardVelMag * cfg.lateralDrag +
      ship.velocityX * (1 - cfg.lateralDrag);

    ship.velocityY =
      headingY * forwardVelMag * cfg.lateralDrag +
      ship.velocityY * (1 - cfg.lateralDrag);

    ship.speed = getSpeed(ship);

    // ==========================================================
    // 9. GIRO NORMAL PELO LEME
    // ==========================================================
    if (ship.speed > cfg.minSteeringSpeed) {
      const steeringPower =
        (ship.speed / cfg.maxSpeed) *
        ship.rudder *
        cfg.turnRate;

      ship.angularVelocity = steeringPower;
    } else {
      ship.angularVelocity *= 1 - cfg.angularDrag;
    }

    ship.rotation = normalizeAngle(
      ship.rotation + ship.angularVelocity * dt
    );
  }
}
